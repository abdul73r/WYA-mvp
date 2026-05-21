'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { Spinner } from '@/components/Spinner';
import { cancelOrderByCustomer, markOrderPaid, subscribeOrder, listOrderItems } from '@/lib/orders';
import { getTruck } from '@/lib/trucks';
import { useAuth } from '@/lib/auth';
import { showToast, ToastHost } from '@/components/Toast';
import type { FoodTruck, Order, OrderStatus } from '@/lib/types';
import { dollars, relativeTime } from '@/lib/utils';

const STAGES: { key: OrderStatus; label: string; sub: string }[] = [
  { key: 'placed',     label: 'Order received',  sub: 'The truck has your request' },
  { key: 'accepted',   label: 'Accepted',        sub: 'The truck is on it' },
  { key: 'preparing',  label: 'Being prepared',  sub: 'Cooking now' },
  { key: 'ready',      label: 'Ready for pickup',sub: 'Head to the truck' },
  { key: 'completed',  label: 'Picked up',       sub: 'Enjoy!' },
];

export default function OrderDetailPage() {
  return (
    <RoleGuard allow={['customer','owner']}>
      <Suspense fallback={<div className="min-h-screen grid place-items-center"><Spinner /></div>}>
        <OrderDetail />
      </Suspense>
      <CustomerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [truck, setTruck] = useState<FoodTruck | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!id) return;
    const u = subscribeOrder(id, async (o) => {
      setOrder(o);
      if (o && !truck) setTruck(await getTruck(o.truck_id));
    });
    listOrderItems(id).then(setItems).catch(() => {});
    return u;
  }, [id]);

  // Stripe Checkout redirect-back: verify the session and mark the order paid
  useEffect(() => {
    const stripeParam = params.get('stripe');
    const sessionId = params.get('session_id');
    if (stripeParam !== 'success' || !sessionId || !id) return;
    setVerifying(true);
    (async () => {
      try {
        const res = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const json = await res.json();
        if (json.paid && json.order_id === id) {
          await markOrderPaid(id, { session_id: sessionId, payment_intent_id: json.payment_intent_id });
        }
      } catch (e) { console.error(e); }
      finally {
        setVerifying(false);
        router.replace(`/orders/${id}`); // strip query string
      }
    })();
  }, [params, id, router]);

  async function cancel() {
    if (!order || !user) return;
    if (!confirm('Cancel this order? You can only cancel before the truck accepts it.')) return;
    try {
      await cancelOrderByCustomer(order.id, user.uid);
      showToast('Order cancelled');
    } catch (e: any) {
      showToast(e?.message || 'Could not cancel');
    }
  }

  if (!order) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;

  const cancelled = order.status === 'cancelled';
  const stageIdx = cancelled ? -1 : STAGES.findIndex((s) => s.key === order.status);
  const headlineStage = STAGES[Math.max(stageIdx, 0)];
  const canCancel = order.customer_id === user?.uid && order.status === 'placed';
  const canRate   = order.customer_id === user?.uid && order.status === 'completed' && !order.rated;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">{order.truck_name}</div>
          <div className="text-[11px] text-text-muted">#{order.id.slice(0,6).toUpperCase()} · {relativeTime(order.placed_at)}</div>
        </div>
      </header>

      {/* Payment-pending banner */}
      {order.payment_status === 'pending' && !cancelled && (
        <div className="px-5 mt-4">
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <div className="font-bold">Payment incomplete</div>
            <div className="text-xs text-text-muted mt-1">
              {verifying ? 'Verifying your payment with Stripe…' : 'You closed the Stripe checkout before paying. Tap the button below to finish.'}
            </div>
          </div>
        </div>
      )}

      {/* Scheduled pickup reminder */}
      {order.scheduled_for && !cancelled && order.status !== 'completed' && (
        <div className="px-5 mt-4">
          <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <div className="text-sm font-bold">
                Pickup scheduled for {(order.scheduled_for as any).toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </div>
              <div className="text-[11px] text-text-muted">The truck will start preparing closer to that time.</div>
            </div>
          </div>
        </div>
      )}

      {/* Pay-at-pickup reminder */}
      {order.payment_method === 'cash_on_pickup' && !cancelled && order.status !== 'completed' && (
        <div className="px-5 mt-4">
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <div className="text-sm font-bold">Bring {dollars(order.total_cents)} for pickup</div>
              <div className="text-[11px] text-text-muted">You'll pay the truck directly when you collect your order</div>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 mt-4">
        <div className="rounded-2xl p-5 border border-accent/30 bg-gradient-to-br from-accent/15 to-surface">
          <div className="text-xs uppercase tracking-widest text-accent font-bold flex items-center gap-2">
            {!cancelled && order.status !== 'completed' && <span className="live-dot" />}
            {cancelled ? 'Cancelled' : headlineStage?.label || 'Order'}
          </div>
          <div className="text-2xl font-extrabold mt-1">
            {cancelled ? 'This order was cancelled' : headlineStage?.sub}
          </div>
          {order.status === 'ready' && truck && (
            <div className="text-xs text-text-muted mt-2">Pickup at <b className="text-white">{truck.name}</b></div>
          )}
          {order.prep_minutes && !cancelled && ['placed','accepted','preparing'].includes(order.status) && (
            <div className="text-xs text-text-muted mt-2">Estimated pickup in <b className="text-white">~{order.prep_minutes} min</b></div>
          )}
        </div>
      </div>

      {/* Pickup code — show prominently when the order is ready */}
      {order.pickup_code && !cancelled && order.status !== 'completed' && order.customer_id === user?.uid && (
        <div className="px-5 mt-4">
          <div className={`rounded-2xl border p-4 text-center ${order.status === 'ready' ? 'border-success/40 bg-success/10' : 'border-stroke bg-surface'}`}>
            <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold">Pickup code</div>
            <div className="text-4xl font-extrabold tracking-[0.4em] mt-2">{order.pickup_code}</div>
            <div className="text-[11px] text-text-muted mt-2">Show this to the truck when you pick up your order.</div>
          </div>
        </div>
      )}

      <div className="px-5 mt-4 flex gap-2 flex-wrap">
        {canRate && (
          <Link href={`/review/${order.id}`} className="btn primary block">⭐ Rate this order</Link>
        )}
        {!cancelled && order.customer_id === user?.uid && (
          <Link href={`/chat/${order.id}`} className="btn ghost">💬 Message truck</Link>
        )}
        {canCancel && (
          <button onClick={cancel} className="btn danger">Cancel order</button>
        )}
      </div>

      {!cancelled && (
        <div className="px-5 mt-5">
          {STAGES.map((s, i) => {
            const done = i <= stageIdx;
            const current = i === stageIdx;
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className={`w-3.5 h-3.5 rounded-full ${done ? 'bg-accent' : 'bg-surface-2 border-2 border-stroke-2'} ${current ? 'ring-4 ring-accent/20' : ''}`} />
                  {i < STAGES.length - 1 && <div className={`w-[2px] flex-1 my-1 ${i < stageIdx ? 'bg-accent' : 'bg-stroke'}`} style={{ minHeight: 26 }} />}
                </div>
                <div className="py-1">
                  <div className={`text-sm font-semibold ${done ? 'text-white' : 'text-text-muted'}`}>{s.label}</div>
                  <div className="text-[11px] text-text-faint">{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-5 mt-6">
        <div className="card p-4">
          <div className="text-xs text-text-muted uppercase tracking-widest font-bold mb-2">Your order</div>
          {items.length === 0 ? (
            <div className="text-sm text-text-muted">Loading items…</div>
          ) : (
            <ul className="text-sm space-y-1.5">
              {items.map((it: any) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.qty}× {it.name}</span>
                  <span className="text-text-muted">{dollars(it.line_total_cents)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 pt-3 border-t border-stroke text-sm space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span>{dollars(order.subtotal_cents)}</span></div>
            {order.discount_cents ? (
              <div className="flex justify-between text-success">
                <span>Promo {order.promo_code ? `· ${order.promo_code}` : ''}</span>
                <span>−{dollars(order.discount_cents)}</span>
              </div>
            ) : null}
            <div className="flex justify-between"><span className="text-text-muted">Tax</span><span>{dollars(order.tax_cents)}</span></div>
            {order.tip_cents ? (
              <div className="flex justify-between"><span className="text-text-muted">Tip</span><span>{dollars(order.tip_cents)}</span></div>
            ) : null}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-stroke mt-2"><span>Total</span><span>{dollars(order.total_cents)}</span></div>
          </div>
          {order.notes && (
            <div className="mt-3 pt-3 border-t border-stroke text-xs text-text-muted">
              <b className="text-white">Notes:</b> {order.notes}
            </div>
          )}
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
