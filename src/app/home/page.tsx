'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { useAuth } from '@/lib/auth';
import { getTruck, subscribeLiveTrucks } from '@/lib/trucks';
import { listMenu } from '@/lib/menu';
import { subscribeFollowing } from '@/lib/follows';
import { subscribeCustomerOrders } from '@/lib/orders';
import { distanceMiles, getCurrentLocation, Coords } from '@/lib/location';
import type { FoodTruck, MenuItem, Order, CuisineTag } from '@/lib/types';
import { Spinner } from '@/components/Spinner';
import { dollars } from '@/lib/utils';

const CATEGORIES: { key: CuisineTag | 'all'; label: string; emoji: string }[] = [
  { key: 'all',      label: 'All',      emoji: '🍽️' },
  { key: 'mexican',  label: 'Mexican',  emoji: '🌮' },
  { key: 'burgers',  label: 'Burgers',  emoji: '🍔' },
  { key: 'halal',    label: 'Halal',    emoji: '🥙' },
  { key: 'korean',   label: 'Korean',   emoji: '🍱' },
  { key: 'seafood',  label: 'Seafood',  emoji: '🦞' },
  { key: 'desserts', label: 'Desserts', emoji: '🍦' },
  { key: 'vegan',    label: 'Vegan',    emoji: '🥗' },
  { key: 'pizza',    label: 'Pizza',    emoji: '🍕' },
  { key: 'bbq',      label: 'BBQ',      emoji: '🍖' },
];

const STATUS_LABEL: Record<Order['status'], string> = {
  placed: 'Order received',
  accepted: 'Accepted',
  preparing: 'Being prepared',
  ready: 'Ready for pickup!',
  completed: 'Picked up',
  cancelled: 'Cancelled',
};

export default function HomePage() {
  return (
    <RoleGuard allow={['customer']}>
      <Home />
      <CustomerNav />
    </RoleGuard>
  );
}

function Home() {
  const { user, profile } = useAuth();
  const [trucks, setTrucks] = useState<FoodTruck[] | null>(null);
  const [me, setMe] = useState<Coords | null>(null);
  const [cat, setCat] = useState<CuisineTag | 'all'>('all');
  const [trending, setTrending] = useState<{ item: MenuItem; truck: FoodTruck }[]>([]);
  const [followed, setFollowed] = useState<FoodTruck[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => subscribeLiveTrucks(setTrucks), []);
  useEffect(() => { getCurrentLocation().then(setMe).catch(() => {}); }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeCustomerOrders(user.uid, (os) => setOrders(os));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeFollowing(user.uid, async (ids) => {
      const arr = await Promise.all(ids.slice(0, 8).map((id) => getTruck(id)));
      setFollowed(arr.filter(Boolean) as FoodTruck[]);
    });
  }, [user]);

  useEffect(() => {
    if (!trucks) return;
    let cancelled = false;
    (async () => {
      const out: { item: MenuItem; truck: FoodTruck }[] = [];
      for (const t of trucks.slice(0, 6)) {
        try {
          const items = await listMenu(t.id);
          for (const it of items.slice(0, 2)) {
            if (!it.sold_out) out.push({ item: it, truck: t });
          }
        } catch {}
        if (out.length >= 10) break;
      }
      if (!cancelled) setTrending(out);
    })();
    return () => { cancelled = true; };
  }, [trucks?.map((t) => t.id).join(',')]);

  const activeOrder = orders.find((o) =>
    !['completed', 'cancelled'].includes(o.status)
  );

  const ranked = useMemo(() => {
    const list = (trucks || [])
      .filter((t) => cat === 'all' || t.cuisine === cat)
      .map((t) => {
        const miles = me && t.location ? distanceMiles(me, { lat: t.location.latitude, lng: t.location.longitude }) : null;
        return { ...t, miles } as FoodTruck & { miles: number | null };
      });
    list.sort((a, b) => (a.miles ?? 999) - (b.miles ?? 999));
    return list;
  }, [trucks, me, cat]);

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto page-enter">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-text-muted font-medium">Hi, {profile?.name?.split(' ')[0] || 'there'}</div>
          <div className="text-base font-bold flex items-center gap-1.5 truncate">
            <span>📍</span>
            <span className="truncate">{me ? 'Near you' : 'Your area'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <Link href="/alerts" className="w-10 h-10 rounded-full bg-surface border border-stroke grid place-items-center relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 1 1 12 0v5l1.5 3h-15L6 13V8z"/><path d="M10 19a2 2 0 1 0 4 0"/>
          </svg>
        </Link>
      </header>

      {/* Search → /search */}
      <div className="px-5 mt-3">
        <Link
          href="/search"
          className="flex items-center gap-2 h-12 px-4 rounded-xl bg-surface border border-stroke text-text-muted text-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
          Search trucks, dishes, cuisines
        </Link>
      </div>

      {/* Active order card */}
      {activeOrder && (
        <div className="px-5 mt-4">
          <Link href={`/orders/${activeOrder.id}`} className="block rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 to-surface p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
              <span className="live-dot" /> {STATUS_LABEL[activeOrder.status]}
            </div>
            <div className="font-bold mt-1">Order from {activeOrder.truck_name}</div>
            <div className="text-xs text-text-muted mt-0.5">#{activeOrder.id.slice(0,6).toUpperCase()} · {dollars(activeOrder.total_cents)}</div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-text-muted">Tap to track</span>
              <span className="text-accent text-lg">›</span>
            </div>
          </Link>
        </div>
      )}

      {/* Promo */}
      <div className="px-5 mt-4">
        <Link href="/map" className="block rounded-xl border border-accent/30 bg-gradient-to-br from-accent/15 to-surface px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent text-white font-bold grid place-items-center">$</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">Free pickup on your first 5 orders</div>
            <div className="text-[11px] text-text-muted">No min · pickup-only MVP</div>
          </div>
          <span className="text-accent text-xl">›</span>
        </Link>
      </div>

      {/* Categories */}
      <div className="mt-5">
        <div className="flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
          {CATEGORIES.map((c) => {
            const active = cat === c.key;
            return (
              <button key={c.key} onClick={() => setCat(c.key)} className="flex-shrink-0 flex flex-col items-center gap-1 w-16">
                <div className={`w-14 h-14 rounded-2xl grid place-items-center text-2xl border transition-colors ${active ? 'border-accent bg-accent/10' : 'border-stroke bg-surface'}`}>
                  {c.emoji}
                </div>
                <span className={`text-[11px] ${active ? 'text-white font-semibold' : 'text-text-muted'}`}>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live now */}
      <div className="flex items-center justify-between px-5 mt-6 mb-3">
        <h2 className="text-base font-bold flex items-center gap-2"><span className="live-dot" /> Live now</h2>
        <Link href="/map" className="text-xs text-text-muted">Map view →</Link>
      </div>

      {trucks === null && <div className="p-6 grid place-items-center"><Spinner /></div>}

      {trucks && ranked.length === 0 && (
        <div className="px-5">
          <div className="rounded-xl border border-stroke bg-surface p-6 text-sm text-text-muted">
            {cat === 'all'
              ? 'No trucks live right now. Check back soon — or follow a truck to get notified when they go live.'
              : `No ${CATEGORIES.find(c => c.key === cat)?.label?.toLowerCase()} trucks live right now.`}
          </div>
        </div>
      )}

      {ranked.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
          {ranked.map((t) => (
            <Link key={t.id} href={`/truck/${t.id}`} className="flex-shrink-0 w-60 rounded-xl bg-surface border border-stroke overflow-hidden">
              <div className="h-28 bg-surface-2 relative">
                {t.logo_url
                  ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full grid place-items-center text-4xl">🚚</div>}
                <span className="absolute top-2 left-2 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent text-white flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
                </span>
                {t.rating_count > 0 && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">⭐ {t.rating.toFixed(1)}</span>
                )}
              </div>
              <div className="p-3">
                <div className="text-sm font-bold truncate">{t.name}</div>
                <div className="text-[11px] text-text-muted truncate capitalize">
                  {t.cuisine}{t.miles != null && <> · {t.miles.toFixed(1)} mi</>}{!t.is_open && <> · Closed</>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Followed trucks */}
      {followed.length > 0 && (
        <>
          <div className="flex items-center justify-between px-5 mt-6 mb-3">
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
                <div className="text-[10px] text-accent font-bold">{t.is_live ? 'LIVE' : ''}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Recently ordered from */}
      {orders.length > 0 && (
        <>
          <div className="flex items-center justify-between px-5 mt-6 mb-3">
            <h2 className="text-base font-bold">Order again</h2>
            <Link href="/orders" className="text-xs text-text-muted">History →</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
            {Array.from(new Map(orders.map(o => [o.truck_id, o])).values()).slice(0, 5).map((o) => {
              const t = (trucks || []).find((x) => x.id === o.truck_id);
              return (
                <Link key={o.truck_id} href={`/truck/${o.truck_id}`} className="flex-shrink-0 w-44 rounded-xl bg-surface border border-stroke overflow-hidden">
                  <div className="aspect-[5/4] bg-surface-2">
                    {t?.logo_url
                      ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full grid place-items-center text-3xl">🚚</div>}
                  </div>
                  <div className="p-2.5">
                    <div className="text-[13px] font-semibold truncate">{o.truck_name}</div>
                    <div className="text-[11px] text-text-muted truncate">Last order · {dollars(o.total_cents)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Featured trucks list */}
      {ranked.length > 0 && (
        <>
          <div className="flex items-center justify-between px-5 mt-6 mb-2">
            <h2 className="text-base font-bold">Featured nearby</h2>
          </div>
          <div className="flex flex-col">
            {ranked.slice(0, 5).map((t) => (
              <Link key={t.id} href={`/truck/${t.id}`} className="px-5 py-3 border-b border-stroke flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-surface-2 overflow-hidden grid place-items-center text-2xl flex-shrink-0">
                  {t.logo_url ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" /> : '🚚'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate flex items-center gap-2">
                    {t.name}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent">LIVE</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5 truncate capitalize">
                    {t.cuisine}
                    {t.miles != null && <> · {t.miles.toFixed(1)} mi</>}
                    {t.rating_count > 0 && <> · ⭐ {t.rating.toFixed(1)} ({t.rating_count})</>}
                  </div>
                </div>
                <span className="text-text-faint">›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Trending dishes */}
      {trending.length > 0 && (
        <>
          <div className="flex items-center justify-between px-5 mt-6 mb-3">
            <h2 className="text-base font-bold">🔥 Trending dishes</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
            {trending.map(({ item, truck }) => (
              <Link key={item.id} href={`/truck/${truck.id}`} className="flex-shrink-0 w-44 rounded-xl bg-surface border border-stroke overflow-hidden">
                <div className="aspect-[5/4] bg-surface-2">
                  {item.photo_url && <img src={item.photo_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="p-2.5">
                  <div className="text-[13px] font-semibold truncate">{item.name}</div>
                  <div className="text-[11px] text-text-muted truncate">{truck.name}</div>
                  <div className="text-[13px] font-bold mt-1">{dollars(item.price_cents)}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="h-4" />
    </div>
  );
}
