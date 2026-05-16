'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import {
  subscribeTruck, goLive, goOffline, setOpenStatus, updateLocation,
} from '@/lib/trucks';
import { subscribeTruckOrders } from '@/lib/orders';
import { getCurrentLocation, watchLocation } from '@/lib/location';
import { playOrderChime } from '@/lib/sound';
import { showToast, ToastHost } from '@/components/Toast';
import type { FoodTruck, Order } from '@/lib/types';
import { dollars, relativeTime } from '@/lib/utils';

export default function OwnerDashboardPage() {
  return (
    <RoleGuard allow={['owner']}>
      <Dashboard />
      <OwnerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function Dashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const truckId = profile?.truck_id;
  const [truck, setTruck] = useState<FoodTruck | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState<'live' | 'loc' | 'open' | null>(null);
  const [autoTrack, setAutoTrack] = useState(true);

  // refs for the order-arrival notifier
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  useEffect(() => { if (!truckId) router.replace('/setup'); }, [truckId, router]);
  useEffect(() => { if (!truckId) return; return subscribeTruck(truckId, setTruck); }, [truckId]);
  useEffect(() => {
    if (!truckId) return;
    return subscribeTruckOrders(truckId, (os) => {
      // Detect new 'placed' orders to chime
      if (firstLoadRef.current) {
        os.forEach((o) => seenIdsRef.current.add(o.id));
        firstLoadRef.current = false;
      } else {
        const justPlaced = os.find((o) => o.status === 'placed' && !seenIdsRef.current.has(o.id));
        if (justPlaced) {
          seenIdsRef.current.add(justPlaced.id);
          playOrderChime();
          showToast(`🛎 New order from ${justPlaced.customer_name}`);
        }
        os.forEach((o) => seenIdsRef.current.add(o.id));
      }
      setOrders(os);
    });
  }, [truckId]);

  // Auto location tracking while live
  useEffect(() => {
    if (!truck?.is_live || !autoTrack || !truckId) return;
    let lastSent = 0;
    const stop = watchLocation((c) => {
      const now = Date.now();
      if (now - lastSent < 30_000) return;        // throttle to ~30s
      lastSent = now;
      updateLocation(truckId, c).catch(() => {});
    });
    return stop;
  }, [truck?.is_live, autoTrack, truckId]);

  async function onGoLive() {
    if (!truckId || !truck) return;
    setBusy('live');
    try {
      if (truck.is_live) {
        await goOffline(truckId);
        showToast('You are offline');
      } else {
        // Try real GPS first; fall back to the saved parking address.
        let coords: { lat: number; lng: number } | null = null;
        try {
          coords = await getCurrentLocation();
        } catch {/* fall through */}
        if (!coords && truck.location) {
          coords = { lat: truck.location.latitude, lng: truck.location.longitude };
        }
        if (!coords) {
          throw new Error('No location yet. Add a parking address in Edit truck profile, or allow location access.');
        }
        await goLive(truckId, coords);
        showToast('You are live!');
      }
    } catch (e: any) {
      showToast(e?.message || 'Could not get your location');
    } finally { setBusy(null); }
  }

  async function onUpdateLocation() {
    if (!truckId) return;
    setBusy('loc');
    try {
      const coords = await getCurrentLocation();
      await updateLocation(truckId, coords);
      showToast('Location updated');
    } catch (e: any) {
      showToast(e?.message || 'Could not get your location');
    } finally { setBusy(null); }
  }

  async function onToggleOpen() {
    if (!truckId || !truck) return;
    setBusy('open');
    try {
      await setOpenStatus(truckId, !truck.is_open);
      showToast(truck.is_open ? 'Marked closed' : 'Marked open');
    } finally { setBusy(null); }
  }

  if (!truck) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;

  const active = orders.filter((o) => ['placed','accepted','preparing','ready'].includes(o.status));
  const today = orders.filter((o) => {
    const d = o.placed_at?.toDate ? o.placed_at.toDate() : null;
    if (!d) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });
  const revenue = today.filter(o => o.status === 'completed').reduce((s, o) => s + o.total_cents, 0);
  const allTimeCompleted = orders.filter(o => o.status === 'completed').length;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface overflow-hidden grid place-items-center text-xl flex-shrink-0">
          {truck.logo_url ? <img src={truck.logo_url} alt="" className="w-full h-full object-cover" /> : '🚚'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-text-muted font-medium">Truck dashboard</div>
          <h1 className="text-base font-bold truncate">{truck.name}</h1>
        </div>
        <Link href={`/truck/${truck.id}`} className="text-xs text-text-muted">Preview</Link>
      </header>

      {/* Cover preview if exists */}
      {truck.cover_url && (
        <div className="mx-5 mt-4 rounded-xl overflow-hidden border border-stroke h-28">
          <img src={truck.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Parking address */}
      <div className="mx-5 mt-3 rounded-xl border border-stroke bg-surface px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-surface-2 grid place-items-center text-text-muted">📍</div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-text-muted uppercase tracking-widest font-bold">Parking address</div>
          {truck.address ? (
            <div className="text-sm font-semibold truncate">{truck.address}</div>
          ) : (
            <div className="text-sm font-semibold text-text-muted">Not set — add one in Edit profile</div>
          )}
          {truck.is_live && (
            <div className="text-[11px] text-accent mt-0.5">📡 Live GPS overrides this while moving</div>
          )}
        </div>
        <Link href="/truck-edit" className="text-xs text-accent font-semibold">Change</Link>
      </div>

      {/* Promotion banner */}
      {truck.promotion && (
        <div className="mx-5 mt-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <span className="text-warning font-bold mr-2">PROMO</span>{truck.promotion}
        </div>
      )}

      {/* Hero status */}
      <div className="px-5 mt-4">
        <div className={`rounded-2xl p-5 border ${truck.is_live ? 'border-accent/40 bg-gradient-to-br from-accent/20 to-surface' : 'border-stroke bg-surface'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-text-muted font-bold flex items-center gap-2">
                {truck.is_live && <span className="live-dot" />}
                {truck.is_live ? 'You are LIVE' : 'Offline'}
              </div>
              <div className="text-2xl font-extrabold mt-1">
                {truck.is_live ? 'Customers can see you now' : 'Go live to be discovered'}
              </div>
              <div className="text-xs text-text-muted mt-1">
                {truck.is_live
                  ? (truck.location_updated_at ? `Location updated ${relativeTime(truck.location_updated_at)}` : 'Live')
                  : 'Tap Go live to broadcast your location.'}
              </div>
            </div>
          </div>

          <button
            onClick={onGoLive}
            className={`btn block mt-4 ${truck.is_live ? 'ghost' : 'primary'}`}
            disabled={!!busy}
          >
            {busy === 'live' ? <Spinner /> : (truck.is_live ? 'End live session' : 'Go live now')}
          </button>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={onUpdateLocation} disabled={!truck.is_live || !!busy} className="btn sm">
              {busy === 'loc' ? <Spinner /> : '📍 Update location'}
            </button>
            <button onClick={onToggleOpen} disabled={!!busy} className="btn sm">
              {busy === 'open' ? <Spinner /> : (truck.is_open ? '🟢 Open · close' : '⚪ Closed · open')}
            </button>
          </div>

          {/* Auto-tracking toggle */}
          {truck.is_live && (
            <label className="flex items-center justify-between mt-3 cursor-pointer">
              <span className="text-xs text-text-muted">📡 Auto-update location every 30s</span>
              <span className={`relative inline-block w-10 h-6 rounded-full transition-colors ${autoTrack ? 'bg-accent' : 'bg-surface-2'}`}>
                <input type="checkbox" checked={autoTrack} onChange={(e) => setAutoTrack(e.target.checked)} className="sr-only" />
                <span className={`absolute top-0.5 ${autoTrack ? 'left-[18px]' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition-all`} />
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Today stats */}
      <div className="px-5 mt-5 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <div className="text-[11px] text-text-muted">Revenue today</div>
          <div className="font-extrabold text-lg mt-0.5">{dollars(revenue)}</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[11px] text-text-muted">Orders today</div>
          <div className="font-extrabold text-lg mt-0.5">{today.length}</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[11px] text-text-muted">Followers</div>
          <div className="font-extrabold text-lg mt-0.5">{truck.follower_count}</div>
        </div>
      </div>

      {/* Active orders */}
      <div className="flex items-center justify-between px-5 mt-6 mb-2">
        <h2 className="text-base font-bold">Active orders</h2>
        <Link href="/orders-owner" className="text-xs text-text-muted">See all</Link>
      </div>
      {active.length === 0 ? (
        <div className="px-5">
          <div className="rounded-xl border border-stroke bg-surface p-5 text-sm text-text-muted">
            No active orders. {truck.is_live ? 'Customers can order from you now.' : 'Go live to start receiving orders.'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {active.slice(0, 4).map((o) => (
            <Link key={o.id} href={`/orders-owner/${o.id}`} className="card p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-semibold truncate">{o.customer_name}</div>
                <div className="text-xs text-text-muted">#{o.id.slice(0,6).toUpperCase()} · {dollars(o.total_cents)} · {relativeTime(o.placed_at)}</div>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-accent">{o.status}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 px-5 mt-6">
        <Link href="/menu" className="btn">Edit menu</Link>
        <Link href="/truck-edit" className="btn">Edit truck profile</Link>
      </div>
      <div className="grid grid-cols-2 gap-2 px-5 mt-2">
        <Link href="/analytics" className="btn">📈 Analytics</Link>
        <Link href="/wallet" className="btn">💵 Wallet</Link>
      </div>
    </div>
  );
}
