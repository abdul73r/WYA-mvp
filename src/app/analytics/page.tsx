'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import { subscribeTruck } from '@/lib/trucks';
import { subscribeTruckOrders } from '@/lib/orders';
import type { FoodTruck, Order } from '@/lib/types';
import { dollars } from '@/lib/utils';

export default function AnalyticsPage() {
  return (
    <RoleGuard allow={['owner']}>
      <Analytics />
      <OwnerNav />
    </RoleGuard>
  );
}

function Analytics() {
  const router = useRouter();
  const { profile } = useAuth();
  const truckId = profile?.truck_id;
  const [truck, setTruck] = useState<FoodTruck | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => { if (!truckId) router.replace('/setup'); }, [truckId, router]);
  useEffect(() => { if (!truckId) return; return subscribeTruck(truckId, setTruck); }, [truckId]);
  useEffect(() => { if (!truckId) return; return subscribeTruckOrders(truckId, setOrders); }, [truckId]);

  // restrict to completed orders for revenue stats
  const completed = useMemo(() => orders.filter((o) => o.status === 'completed'), [orders]);

  const totalRevenue = completed.reduce((s, o) => s + o.total_cents, 0);
  const totalOrders  = completed.length;
  const aov          = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
  const uniqueCustomers = new Set(completed.map((o) => o.customer_id)).size;
  const returnCustomers = (() => {
    const counts = new Map<string, number>();
    completed.forEach((o) => counts.set(o.customer_id, (counts.get(o.customer_id) || 0) + 1));
    let n = 0;
    counts.forEach((c) => { if (c > 1) n++; });
    return n;
  })();

  // Daily revenue last 7 days
  const days = useMemo(() => {
    const out: { label: string; revenue: number; orders: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const next = new Date(d.getTime() + 24*60*60*1000);
      const dayOrders = completed.filter((o) => {
        const od = o.placed_at?.toDate ? o.placed_at.toDate() : null;
        return od && od >= d && od < next;
      });
      out.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        revenue: dayOrders.reduce((s, o) => s + o.total_cents, 0),
        orders: dayOrders.length,
      });
    }
    return out;
  }, [completed]);

  const maxDay = Math.max(...days.map((d) => d.revenue), 1);

  // Peak hour distribution
  const hours = useMemo(() => {
    const buckets = new Array(24).fill(0) as number[];
    completed.forEach((o) => {
      const d = o.placed_at?.toDate ? o.placed_at.toDate() : null;
      if (!d) return;
      buckets[d.getHours()]++;
    });
    return buckets;
  }, [completed]);
  const maxHour = Math.max(...hours, 1);

  if (!truck) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3">
        <div className="text-[11px] text-text-muted">{truck.name}</div>
        <h1 className="text-lg font-bold">Analytics</h1>
      </header>

      {/* Stat cards */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-2">
        <div className="card p-4">
          <div className="text-[11px] text-text-muted uppercase tracking-widest font-bold">Total revenue</div>
          <div className="text-2xl font-extrabold mt-1">{dollars(totalRevenue)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] text-text-muted uppercase tracking-widest font-bold">Completed orders</div>
          <div className="text-2xl font-extrabold mt-1">{totalOrders}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] text-text-muted uppercase tracking-widest font-bold">Avg order value</div>
          <div className="text-2xl font-extrabold mt-1">{dollars(aov)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] text-text-muted uppercase tracking-widest font-bold">Repeat customers</div>
          <div className="text-2xl font-extrabold mt-1">{returnCustomers}/{uniqueCustomers}</div>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="px-5 mt-6">
        <h2 className="text-sm font-bold mb-3">Revenue, last 7 days</h2>
        <div className="card p-4">
          <div className="flex items-end gap-2 h-32">
            {days.map((d) => {
              const h = Math.max(2, Math.round((d.revenue / maxDay) * 100));
              return (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="text-[10px] text-text-faint">{d.revenue > 0 ? `$${(d.revenue/100).toFixed(0)}` : ''}</div>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-accent to-accent/40"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-text-muted">{d.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Peak hours chart */}
      <div className="px-5 mt-6">
        <h2 className="text-sm font-bold mb-3">Peak hours (all-time)</h2>
        <div className="card p-4">
          <div className="flex items-end gap-1 h-24">
            {hours.map((h, i) => {
              const ratio = Math.max(2, Math.round((h / maxHour) * 100));
              const peak = h === maxHour && h > 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-sm ${peak ? 'bg-accent' : 'bg-surface-2 border-t-2 border-accent/40'}`}
                      style={{ height: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-text-faint mt-2">
            <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 text-xs text-text-faint">
        Analytics include completed orders only. New numbers appear in real time as orders complete.
      </div>
    </div>
  );
}
