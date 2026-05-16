'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import { setOrderStatus, subscribeTruckOrders } from '@/lib/orders';
import { showToast, ToastHost } from '@/components/Toast';
import type { Order, OrderStatus } from '@/lib/types';
import { dollars, relativeTime } from '@/lib/utils';

export default function OwnerOrdersPage() {
  return (
    <RoleGuard allow={['owner']}>
      <OwnerOrders />
      <OwnerNav />
      <ToastHost />
    </RoleGuard>
  );
}

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  placed: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
  cancelled: null,
};
const NEXT_LABEL: Record<OrderStatus, string> = {
  placed: 'Accept',
  accepted: 'Start preparing',
  preparing: 'Mark ready',
  ready: 'Picked up',
  completed: '',
  cancelled: '',
};

function statusTone(s: OrderStatus) {
  if (s === 'ready') return 'text-success';
  if (['cancelled', 'completed'].includes(s)) return 'text-text-muted';
  return 'text-accent';
}

function OwnerOrders() {
  const router = useRouter();
  const { profile } = useAuth();
  const truckId = profile?.truck_id;
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  useEffect(() => { if (!truckId) router.replace('/setup'); }, [truckId, router]);
  useEffect(() => { if (!truckId) return; return subscribeTruckOrders(truckId, setOrders); }, [truckId]);

  const list = (orders || []).filter((o) =>
    tab === 'active' ? !['completed','cancelled'].includes(o.status) : o.status === 'completed' || o.status === 'cancelled'
  );

  async function advance(o: Order) {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    await setOrderStatus(o.id, next);
    showToast(`Marked ${next}`);
  }

  async function cancel(o: Order) {
    if (!confirm('Cancel this order?')) return;
    await setOrderStatus(o.id, 'cancelled');
    showToast('Order cancelled');
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3">
        <h1 className="text-lg font-bold">Orders</h1>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setTab('active')}    className={`chip ${tab === 'active'    ? 'active' : ''}`}>
            Active{orders ? ` · ${orders.filter(o => !['completed','cancelled'].includes(o.status)).length}` : ''}
          </button>
          <button onClick={() => setTab('completed')} className={`chip ${tab === 'completed' ? 'active' : ''}`}>History</button>
        </div>
      </header>

      {orders === null && <div className="p-10 grid place-items-center"><Spinner /></div>}
      {orders && list.length === 0 && (
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl mx-auto mb-3">📋</div>
          <div className="font-bold">No orders {tab === 'active' ? 'right now' : 'in history'}</div>
          <div className="text-text-muted text-sm mt-1">Orders will appear here in real time.</div>
        </div>
      )}

      <div className="flex flex-col gap-3 px-5 mt-4">
        {list.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold truncate">{o.customer_name}</div>
                <div className="text-xs text-text-muted mt-0.5">#{o.id.slice(0,6).toUpperCase()} · {relativeTime(o.placed_at)} · {dollars(o.total_cents)}</div>
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${statusTone(o.status)}`}>{o.status}</span>
            </div>
            {o.notes && <div className="text-xs text-text-muted mt-2 px-3 py-2 bg-surface-2 rounded-lg"><b className="text-white">Notes:</b> {o.notes}</div>}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Link href={`/orders-owner/${o.id}`} className="btn sm">Details</Link>
              {NEXT_STATUS[o.status] && (
                <button onClick={() => advance(o)} className="btn sm primary">{NEXT_LABEL[o.status]}</button>
              )}
              {!['completed','cancelled'].includes(o.status) && (
                <button onClick={() => cancel(o)} className="btn sm danger">Cancel</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
