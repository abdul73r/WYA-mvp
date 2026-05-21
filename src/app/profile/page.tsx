'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { useAuth } from '@/lib/auth';
import { getTruck } from '@/lib/trucks';
import { subscribeFollowing } from '@/lib/follows';
import { subscribeCustomerOrders } from '@/lib/orders';
import type { FoodTruck, Order } from '@/lib/types';
import { dollars, relativeTime } from '@/lib/utils';

export default function ProfilePage() {
  return (
    <RoleGuard allow={['customer']}>
      <Profile />
      <CustomerNav />
    </RoleGuard>
  );
}

function Profile() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [followed, setFollowed] = useState<FoodTruck[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeFollowing(user.uid, async (ids) => {
      const arr = await Promise.all(ids.map((id) => getTruck(id)));
      setFollowed(arr.filter(Boolean) as FoodTruck[]);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeCustomerOrders(user.uid, setOrders);
  }, [user]);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      {/* Header banner */}
      <div className="bg-gradient-to-br from-accent/30 via-bg to-bg px-5 pt-10 pb-6 border-b border-stroke">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-accent grid place-items-center font-extrabold text-3xl">
            {profile?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-xl truncate">{profile?.name}</div>
            <div className="text-xs text-text-muted truncate">{profile?.email}</div>
            <div className="text-[10px] text-accent uppercase tracking-wider mt-1">Customer</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 mt-4 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <div className="font-extrabold text-xl">{orders.length}</div>
          <div className="text-[11px] text-text-muted">Orders</div>
        </div>
        <div className="card p-3 text-center">
          <div className="font-extrabold text-xl">{followed.length}</div>
          <div className="text-[11px] text-text-muted">Following</div>
        </div>
        <div className="card p-3 text-center">
          <div className="font-extrabold text-xl">{orders.filter(o => o.status === 'completed').length}</div>
          <div className="text-[11px] text-text-muted">Completed</div>
        </div>
      </div>

      {/* Followed trucks */}
      {followed.length > 0 && (
        <>
          <div className="px-5 mt-6 mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold">Following</h2>
            <span className="text-xs text-text-muted">{followed.length}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
            {followed.map((t) => (
              <Link key={t.id} href={`/truck/${t.id}`} className="flex-shrink-0 w-20 flex flex-col items-center gap-1.5">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke overflow-hidden grid place-items-center text-2xl">
                  {t.logo_url ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" /> : '🚚'}
                </div>
                <div className="text-[11px] font-semibold truncate w-full text-center">{t.name}</div>
                {t.is_live && <div className="text-[10px] text-accent font-bold">LIVE</div>}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Recent orders */}
      {orders.length > 0 && (
        <>
          <div className="px-5 mt-6 mb-2">
            <h2 className="text-base font-bold">Recent orders</h2>
          </div>
          <div>
            {orders.slice(0, 3).map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="px-5 py-3 border-b border-stroke flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-surface-2 grid place-items-center text-xl flex-shrink-0">🍽️</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{o.truck_name}</div>
                  <div className="text-xs text-text-muted">{relativeTime(o.placed_at)} · {dollars(o.total_cents)}</div>
                </div>
                <span className="text-text-faint">›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Settings */}
      <div className="mt-6">
        <Link href="/orders" className="px-5 py-4 border-t border-b border-stroke flex items-center justify-between">
          <span>Order history</span><span className="text-text-faint">›</span>
        </Link>
        <Link href="/following" className="px-5 py-4 border-b border-stroke flex items-center justify-between">
          <span>Followed trucks</span><span className="text-text-faint">›</span>
        </Link>
        <Link href="/account" className="px-5 py-4 border-b border-stroke flex items-center justify-between">
          <span>⚙️ Account settings</span><span className="text-text-faint">›</span>
        </Link>
        <Link href="/help" className="px-5 py-4 border-b border-stroke flex items-center justify-between">
          <span>💬 Help &amp; FAQ</span><span className="text-text-faint">›</span>
        </Link>
        <button
          onClick={async () => { await signOut(); router.replace('/'); }}
          className="w-full text-left px-5 py-4 border-b border-stroke flex items-center justify-between"
        >
          <span>Sign out</span><span className="text-text-faint">›</span>
        </button>
      </div>
    </div>
  );
}
