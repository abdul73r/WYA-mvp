'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { listOrderItems, setOrderStatus, subscribeOrder } from '@/lib/orders';
import { showToast, ToastHost } from '@/components/Toast';
import type { Order, OrderStatus } from '@/lib/types';
import { dollars, relativeTime } from '@/lib/utils';

const NEXT: Record<OrderStatus, OrderStatus | null> = {
  placed: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'completed', completed: null, cancelled: null,
};
const LABEL: Record<OrderStatus, string> = {
  placed: 'Accept', accepted: 'Start preparing', preparing: 'Mark ready', ready: 'Picked up', completed: '', cancelled: '',
};

export default function OwnerOrderDetailPage() {
  return (
    <RoleGuard allow={['owner']}>
      <Detail />
      <OwnerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    const u = subscribeOrder(id, setOrder);
    listOrderItems(id).then(setItems).catch(() => {});
    return u;
  }, [id]);

  if (!order) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  const next = NEXT[order.status];

  return (
    <div className="min-h-screen max-w-md mx-auto pb-28 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">{order.customer_name}</div>
          <div className="text-[11px] text-text-muted">#{order.id.slice(0,6).toUpperCase()} · {relativeTime(order.placed_at)}</div>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-accent">{order.status}</span>
      </header>

      {/* Payment-method banner */}
      {order.payment_method === 'cash_on_pickup' && (
        <div className="mx-5 mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">💵</span>
          <div>
            <div className="text-sm font-bold">Collect {dollars(order.total_cents)} at pickup</div>
            <div className="text-[11px] text-text-muted">Customer is paying cash or card in person</div>
          </div>
        </div>
      )}
      {order.payment_method === 'stripe' && order.payment_status === 'paid' && (
        <div className="mx-5 mt-4 rounded-xl border border-success/40 bg-success/10 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div>
            <div className="text-sm font-bold">Paid {dollars(order.total_cents)} via card</div>
            <div className="text-[11px] text-text-muted">Funds will land in your Stripe balance · transfer from Wallet</div>
          </div>
        </div>
      )}

      <div className="px-5 mt-4">
        <Link href={`/chat/${order.id}`} className="btn ghost block">💬 Message {order.customer_name.split(' ')[0]}</Link>
      </div>

      <div className="px-5 mt-4">
        <div className="card p-4">
          <div className="text-xs text-text-muted uppercase tracking-widest font-bold mb-2">Items</div>
          {items.length === 0 ? (
            <div className="text-sm text-text-muted">Loading…</div>
          ) : (
            <ul className="text-sm space-y-2">
              {items.map((it: any) => (
                <li key={it.id}>
                  <div className="flex justify-between">
                    <span><b>{it.qty}×</b> {it.name}</span>
                    <span className="text-text-muted">{dollars(it.line_total_cents)}</span>
                  </div>
                  {it.notes && (
                    <div className="text-[11px] text-warning mt-0.5 ml-5">⚠ {it.notes}</div>
                  )}
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
              <div className="flex justify-between text-success"><span>Tip</span><span>{dollars(order.tip_cents)}</span></div>
            ) : null}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-stroke mt-2"><span>Total</span><span>{dollars(order.total_cents)}</span></div>
          </div>
          {order.notes && (
            <div className="mt-3 pt-3 border-t border-stroke text-xs text-warning">
              <b>Customer notes:</b> {order.notes}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {next && order.status !== 'ready' && (
            <button className="btn primary block" disabled={busy} onClick={async () => {
              setBusy(true);
              await setOrderStatus(order.id, next);
              showToast(`Marked ${next}`);
              setBusy(false);
            }}>{busy ? <Spinner /> : LABEL[order.status]}</button>
          )}

          {/* "Ready → Picked up" requires the customer's 4-digit code */}
          {order.status === 'ready' && order.pickup_code && (
            <PickupCodeVerify order={order} onConfirm={async () => {
              setBusy(true);
              await setOrderStatus(order.id, 'completed');
              showToast('Order picked up — payout added to your wallet');
              setBusy(false);
            }} busy={busy} />
          )}
          {order.status === 'ready' && !order.pickup_code && next && (
            <button className="btn primary block" disabled={busy} onClick={async () => {
              setBusy(true);
              await setOrderStatus(order.id, next);
              setBusy(false);
            }}>{busy ? <Spinner /> : LABEL[order.status]}</button>
          )}

          {!['completed','cancelled'].includes(order.status) && (
            <button className="btn danger" disabled={busy} onClick={async () => {
              if (!confirm('Cancel this order?')) return;
              setBusy(true);
              await setOrderStatus(order.id, 'cancelled');
              showToast('Cancelled');
              setBusy(false);
            }}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline 4-digit code verifier shown to the owner when status is "ready". */
function PickupCodeVerify({ order, onConfirm, busy }: {
  order: Order; onConfirm: () => void; busy: boolean;
}) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function check() {
    setErr(null);
    if (code.trim() === (order.pickup_code || '').trim()) {
      onConfirm();
    } else {
      setErr('Code doesn’t match. Ask the customer to show their order page.');
    }
  }

  return (
    <div className="w-full">
      <div className="card p-3 flex items-center gap-3">
        <input
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="4-digit pickup code"
          className="input flex-1 text-center text-2xl tracking-[0.5em] font-bold"
        />
        <button onClick={check} disabled={busy || code.length !== 4} className="btn primary">
          {busy ? <Spinner /> : 'Confirm pickup'}
        </button>
      </div>
      {err && <div className="text-xs text-accent mt-2">{err}</div>}
    </div>
  );
}
