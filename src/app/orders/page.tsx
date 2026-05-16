'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { useAuth } from '@/lib/auth';
import { subscribeCustomerOrders, listOrderItems } from '@/lib/orders';
import { addToCart, useCart } from '@/lib/cart';
import { Spinner } from '@/components/Spinner';
import { showToast, ToastHost } from '@/components/Toast';
import type { Order } from '@/lib/types';
import { dollars, relativeTime } from '@/lib/utils';

export default function OrdersPage() {
  return (
    <RoleGuard allow={['customer']}>
      <Orders />
      <CustomerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function statusLabel(s: Order['status']) {
  switch (s) {
    case 'placed': return 'Order received';
    case 'accepted': return 'Accepted';
    case 'preparing': return 'Being prepared';
    case 'ready': return 'Ready for pickup';
    case 'completed': return 'Picked up';
    case 'cancelled': return 'Cancelled';
  }
}

function statusTone(s: Order['status']) {
  if (s === 'ready') return 'text-success';
  if (['cancelled','completed'].includes(s)) return 'text-text-muted';
  return 'text-accent';
}

function Orders() {
  const { user } = useAuth();
  const cart = useCart();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeCustomerOrders(user.uid, setOrders);
  }, [user]);

  async function reorder(o: Order) {
    try {
      const items = await listOrderItems(o.id);
      if (!items.length) return;
      // Replace cart with these items
      if (cart && cart.truck_id !== o.truck_id) {
        const ok = confirm(`Your cart has items from ${cart.truck_name}. Replace it with items from ${o.truck_name}?`);
        if (!ok) return;
      }
      items.forEach((it: any) => {
        addToCart(o.truck_id, o.truck_name, {
          menu_item_id: it.menu_item_id,
          name: it.name,
          unit_price_cents: it.unit_price_cents,
          qty: it.qty,
        });
      });
      showToast('Items added to your cart');
    } catch (e: any) {
      showToast(e?.message || 'Could not reorder');
    }
  }

  const active = (orders || []).filter((o) => !['completed','cancelled'].includes(o.status));
  const past = (orders || []).filter((o) => ['completed','cancelled'].includes(o.status));

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3">
        <h1 className="text-lg font-bold">Your orders</h1>
      </header>

      {orders === null && <div className="p-10 grid place-items-center"><Spinner /></div>}

      {orders && orders.length === 0 && (
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl mx-auto mb-3">📦</div>
          <div className="font-bold">You haven't ordered yet</div>
          <div className="text-text-muted text-sm mt-1">Find a live truck nearby.</div>
          <Link href="/map" className="btn primary mt-5 inline-flex">Open the map</Link>
        </div>
      )}

      {/* Active section */}
      {active.length > 0 && (
        <>
          <div className="px-5 mt-4 mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold">Active</h2>
            <span className="live-dot" />
          </div>
          <div className="flex flex-col gap-3 px-5">
            {active.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="card p-4 block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-text-muted">{relativeTime(o.placed_at)}</div>
                    <div className="font-bold mt-0.5 truncate">{o.truck_name}</div>
                    <div className="text-xs text-text-muted mt-1">#{o.id.slice(0,6).toUpperCase()} · {dollars(o.total_cents)}</div>
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${statusTone(o.status)}`}>{statusLabel(o.status)}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Past section */}
      {past.length > 0 && (
        <>
          <div className="px-5 mt-6 mb-2">
            <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold">History</h2>
          </div>
          <div className="flex flex-col gap-3 px-5">
            {past.map((o) => (
              <div key={o.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-text-muted">{relativeTime(o.placed_at)}</div>
                    <div className="font-bold mt-0.5 truncate">{o.truck_name}</div>
                    <div className="text-xs text-text-muted mt-1">#{o.id.slice(0,6).toUpperCase()} · {dollars(o.total_cents)}</div>
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${statusTone(o.status)}`}>{statusLabel(o.status)}</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => reorder(o)} className="btn sm">Reorder</button>
                  <Link href={`/orders/${o.id}`} className="btn sm">Details</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
