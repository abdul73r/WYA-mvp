'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { PageShell } from '@/components/PageShell';
import { useAuth } from '@/lib/auth';
import { subscribeFollowing } from '@/lib/follows';
import { getTruck } from '@/lib/trucks';
import type { FoodTruck } from '@/lib/types';
import { Spinner } from '@/components/Spinner';

export default function FollowingPage() {
  return (
    <RoleGuard allow={['customer']}>
      <Following />
      <CustomerNav />
    </RoleGuard>
  );
}

function Following() {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[] | null>(null);
  const [trucks, setTrucks] = useState<FoodTruck[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeFollowing(user.uid, setIds);
  }, [user]);

  useEffect(() => {
    if (!ids) return;
    Promise.all(ids.map((id) => getTruck(id))).then((arr) =>
      setTrucks(arr.filter(Boolean) as FoodTruck[])
    );
  }, [ids?.join(',')]);

  return (
    <PageShell title="Following">
      {ids === null && <div className="p-10 grid place-items-center"><Spinner /></div>}
      {ids && ids.length === 0 && (
        <div className="p-10 text-center">
          <div className="text-text-muted text-sm">You're not following any trucks yet.</div>
          <Link href="/map" className="btn primary mt-4 inline-flex">Discover trucks</Link>
        </div>
      )}
      <div className="px-5 mt-2 flex flex-col gap-3">
        {trucks.map((t) => (
          <Link key={t.id} href={`/truck/${t.id}`} className="card p-3 flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-surface-2 overflow-hidden grid place-items-center text-xl">
              {t.logo_url ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" /> : '🚚'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate flex items-center gap-2">
                {t.name}
                {t.is_live && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent">LIVE</span>}
              </div>
              <div className="text-xs text-text-muted capitalize truncate">{t.cuisine}</div>
            </div>
            <span className="text-text-faint">›</span>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
