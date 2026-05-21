'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { useAuth } from '@/lib/auth';
import { subscribeTruck } from '@/lib/trucks';
import type { FoodTruck } from '@/lib/types';

export default function OwnerProfilePage() {
  return (
    <RoleGuard allow={['owner']}>
      <OwnerProfile />
      <OwnerNav />
    </RoleGuard>
  );
}

function OwnerProfile() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const truckId = profile?.truck_id;
  const [truck, setTruck] = useState<FoodTruck | null>(null);

  useEffect(() => { if (!truckId) return; return subscribeTruck(truckId, setTruck); }, [truckId]);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <div className="bg-gradient-to-br from-accent/30 via-bg to-bg px-5 pt-10 pb-6 border-b border-stroke">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-surface border border-stroke overflow-hidden grid place-items-center text-3xl">
            {truck?.logo_url ? <img src={truck.logo_url} alt="" className="w-full h-full object-cover" /> : '🚚'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-xl truncate">{truck?.name || profile?.name}</div>
            <div className="text-xs text-text-muted truncate">{profile?.email}</div>
            <div className="text-[10px] text-accent uppercase tracking-wider mt-1">Truck owner</div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Link href="/wallet" className="px-5 py-4 border-b border-stroke flex items-center justify-between">
          <span>💵 Wallet &amp; payouts</span><span className="text-text-faint">›</span>
        </Link>
        <Link href="/truck-edit" className="px-5 py-4 border-b border-stroke flex items-center justify-between">
          <span>Edit truck profile</span><span className="text-text-faint">›</span>
        </Link>
        <Link href="/menu" className="px-5 py-4 border-b border-stroke flex items-center justify-between">
          <span>Menu</span><span className="text-text-faint">›</span>
        </Link>
        <Link href="/owner-reviews" className="px-5 py-4 border-b border-stroke flex items-center justify-between">
          <span>Reviews{truck && truck.rating_count > 0 ? ` · ⭐ ${truck.rating.toFixed(1)}` : ''}</span><span className="text-text-faint">›</span>
        </Link>
        <Link href="/analytics" className="px-5 py-4 border-b border-stroke flex items-center justify-between">
          <span>Analytics</span><span className="text-text-faint">›</span>
        </Link>
        {truck && (
          <Link href={`/truck/${truck.id}`} className="px-5 py-4 border-b border-stroke flex items-center justify-between">
            <span>Preview customer view</span><span className="text-text-faint">›</span>
          </Link>
        )}
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
