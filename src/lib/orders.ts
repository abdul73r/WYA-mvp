'use client';
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, query,
  serverTimestamp, updateDoc, where, writeBatch, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CartLine, Order, OrderStatus } from './types';
import { addNotification } from './notifications';

const TAX_RATE = 0.0825;

function ts(o: Order): number {
  return (o.placed_at as any)?.toMillis?.() ?? 0;
}

export async function placeOrder(args: {
  customer_id: string;
  customer_name: string;
  truck_id: string;
  truck_name: string;
  lines: CartLine[];
  notes?: string;
  tip_cents?: number;
  promo_code?: string;
  discount_cents?: number;
  prep_minutes?: number;
  /** 'paid' = simulated payment (no Stripe). 'pending' = waiting for Stripe Checkout to confirm. */
  payment_status?: 'pending' | 'paid';
}): Promise<{ order_id: string; pickup_code: string; total_cents: number }> {
  const subtotal = args.lines.reduce((s, l) => s + l.unit_price_cents * l.qty, 0);
  const discount = Math.min(args.discount_cents || 0, subtotal);
  const tax = Math.round((subtotal - discount) * TAX_RATE);
  const tip = args.tip_cents || 0;
  const total = subtotal - discount + tax + tip;
  const pickupCode = String(Math.floor(1000 + Math.random() * 9000));
  const paymentStatus = args.payment_status || 'paid';

  const orderRef = await addDoc(collection(db, 'orders'), {
    customer_id: args.customer_id,
    customer_name: args.customer_name,
    truck_id: args.truck_id,
    truck_name: args.truck_name,
    status: 'placed' as OrderStatus,
    mode: 'pickup',
    subtotal_cents: subtotal,
    discount_cents: discount,
    promo_code: args.promo_code || '',
    tax_cents: tax,
    tip_cents: tip,
    total_cents: total,
    prep_minutes: args.prep_minutes || 0,
    pickup_code: pickupCode,
    payment_status: paymentStatus,
    notes: args.notes || '',
    rated: false,
    placed_at: serverTimestamp(),
  });

  const batch = writeBatch(db);
  args.lines.forEach((l) => {
    const itemRef = doc(collection(db, 'orders', orderRef.id, 'order_items'));
    batch.set(itemRef, {
      menu_item_id: l.menu_item_id,
      name: l.name,
      unit_price_cents: l.unit_price_cents,
      qty: l.qty,
      line_total_cents: l.unit_price_cents * l.qty,
      notes: l.notes || '',
    });
  });
  await batch.commit();

  // Only notify the customer when payment is already settled (simulated flow).
  // For pending Stripe flow, the notification fires after verification.
  if (paymentStatus === 'paid') {
    await addNotification({
      user_id: args.customer_id,
      type: 'order_status',
      title: `Order placed at ${args.truck_name}`,
      body: 'Waiting for the truck to accept your order.',
      link: `/orders/${orderRef.id}`,
    });
  }

  return { order_id: orderRef.id, pickup_code: pickupCode, total_cents: total };
}

/**
 * Mark an order as paid after Stripe Checkout has been verified.
 * Records the Stripe IDs and notifies the customer that payment went through.
 */
export async function markOrderPaid(orderId: string, stripeIds: {
  session_id: string;
  payment_intent_id?: string;
}) {
  const ref = doc(db, 'orders', orderId);
  await updateDoc(ref, {
    payment_status: 'paid',
    stripe_session_id: stripeIds.session_id,
    stripe_payment_intent_id: stripeIds.payment_intent_id || '',
  });
  const order = await getOrder(orderId);
  if (order) {
    await addNotification({
      user_id: order.customer_id,
      type: 'order_status',
      title: `Payment confirmed · ${order.truck_name}`,
      body: 'Waiting for the truck to accept your order.',
      link: `/orders/${orderId}`,
    });
  }
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, 'orders', orderId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null;
}

export function subscribeOrder(orderId: string, cb: (o: Order | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'orders', orderId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null),
    (err) => { console.error('order subscribe error', err); cb(null); },
  );
}

export function subscribeCustomerOrders(
  customerId: string,
  cb: (orders: Order[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'orders'), where('customer_id', '==', customerId));
  return onSnapshot(
    q,
    (qs) => {
      const list = qs.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      list.sort((a, b) => ts(b) - ts(a));
      cb(list);
    },
    (err) => { console.error('customer orders error', err); cb([]); },
  );
}

/** Truck-side orders feed. Hides orders that haven't been paid yet (pending_payment). */
export function subscribeTruckOrders(
  truckId: string,
  cb: (orders: Order[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'orders'), where('truck_id', '==', truckId));
  return onSnapshot(
    q,
    (qs) => {
      const list = qs.docs
        .map((d) => ({ id: d.id, ...d.data() } as Order))
        .filter((o) => o.payment_status !== 'pending'); // owner only sees paid orders
      list.sort((a, b) => ts(b) - ts(a));
      cb(list);
    },
    (err) => { console.error('truck orders error', err); cb([]); },
  );
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  const patch: any = { status };
  if (status === 'accepted') patch.accepted_at = serverTimestamp();
  if (status === 'ready') patch.ready_at = serverTimestamp();
  if (status === 'completed') patch.completed_at = serverTimestamp();
  if (status === 'cancelled') patch.cancelled_at = serverTimestamp();
  await updateDoc(doc(db, 'orders', orderId), patch);

  const order = await getOrder(orderId);
  if (order) {
    const titleMap: Record<OrderStatus, string> = {
      placed: 'Order placed',
      accepted: 'Your order was accepted',
      preparing: 'Your order is being prepared',
      ready: 'Your order is ready for pickup',
      completed: 'Order completed — please rate the truck',
      cancelled: 'Order cancelled',
    };
    await addNotification({
      user_id: order.customer_id,
      type: 'order_status',
      title: `${titleMap[status]} · ${order.truck_name}`,
      link: status === 'completed' ? `/review/${orderId}` : `/orders/${orderId}`,
    });
  }
}

export async function cancelOrderByCustomer(orderId: string, customerId: string) {
  const order = await getOrder(orderId);
  if (!order || order.customer_id !== customerId) throw new Error('Not your order');
  if (order.status !== 'placed') {
    throw new Error('Cannot cancel — the truck already accepted your order.');
  }
  await updateDoc(doc(db, 'orders', orderId), {
    status: 'cancelled',
    cancelled_at: serverTimestamp(),
    cancelled_by: 'customer',
  });
}

export async function listOrderItems(orderId: string) {
  const qs = await getDocs(collection(db, 'orders', orderId, 'order_items'));
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}
