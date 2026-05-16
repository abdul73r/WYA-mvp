'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { subscribeLiveTrucks } from '@/lib/trucks';
import { getCurrentLocation, distanceMiles, openDirections, Coords } from '@/lib/location';
import type { FoodTruck, CuisineTag } from '@/lib/types';

const Map = dynamic(
  () => import('@/components/Map').then((mod) => ({ default: mod.Map })),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 grid place-items-center text-text-muted text-sm">Loading map…</div>,
  },
);

const FALLBACK: Coords = { lat: 40.7197, lng: -73.9573 };

const FILTERS: { key: CuisineTag | 'all'; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'mexican',  label: 'Mexican' },
  { key: 'burgers',  label: 'Burgers' },
  { key: 'halal',    label: 'Halal' },
  { key: 'korean',   label: 'Korean' },
  { key: 'seafood',  label: 'Seafood' },
  { key: 'desserts', label: 'Desserts' },
  { key: 'vegan',    label: 'Vegan' },
  { key: 'pizza',    label: 'Pizza' },
  { key: 'bbq',      label: 'BBQ' },
];

type SortKey = 'closest' | 'rated';

function walkMinutes(miles: number) {
  return Math.max(1, Math.round(miles * 20));
}

function movedRecently(t: FoodTruck): boolean {
  const ts = (t.location_updated_at as any)?.toDate?.();
  if (!ts) return false;
  return Date.now() - ts.getTime() < 2 * 60 * 1000;
}

export default function MapPage() {
  return (
    <RoleGuard allow={['customer']}>
      <MapView />
      <CustomerNav />
    </RoleGuard>
  );
}

function MapView() {
  const [me, setMe] = useState<Coords | null>(null);
  const [meDenied, setMeDenied] = useState(false);
  const [trucks, setTrucks] = useState<FoodTruck[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<CuisineTag | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('closest');

  useEffect(() => subscribeLiveTrucks(setTrucks), []);
  useEffect(() => {
    getCurrentLocation()
      .then((c) => { setMe(c); setMeDenied(false); })
      .catch(() => { setMe(FALLBACK); setMeDenied(true); });
  }, []);

  const center = me || FALLBACK;

  const filtered = useMemo(() => {
    const list = (trucks || []).filter((t) => filter === 'all' || t.cuisine === filter);
    const decorated = list.map((t) => {
      const miles = me && t.location ? distanceMiles(me, { lat: t.location.latitude, lng: t.location.longitude }) : null;
      return { ...t, miles } as FoodTruck & { miles: number | null };
    });
    if (sort === 'rated') decorated.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else decorated.sort((a, b) => (a.miles ?? 999) - (b.miles ?? 999));
    return decorated;
  }, [trucks, filter, sort, me]);

  const pins = useMemo(() => {
    return filtered
      .filter((t) => !!t.location)
      .map((t) => ({
        id: t.id,
        lat: t.location!.latitude,
        lng: t.location!.longitude,
        active: selected === t.id,
        image: t.logo_url || undefined,
        label: t.name,
        onClick: () => setSelected(t.id),
      }));
  }, [filtered, selected]);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-4 py-3 flex items-center gap-2">
        <h1 className="text-lg font-bold flex-1">Live map</h1>
        <Link href="/search" className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center" aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
        </Link>
      </header>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto px-4 pt-3 no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`chip ${filter === f.key ? 'active' : ''}`}>
            {f.label}
          </button>
        ))}
      </div>

      {meDenied && (
        <div className="mx-4 mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Location blocked — distances and walking times are estimates. Allow location in your browser settings to fix.
        </div>
      )}

      {/* Contained map (45% of viewport height) */}
      <div className="relative mx-4 mt-3 rounded-2xl overflow-hidden border border-stroke" style={{ height: '45vh', minHeight: 280 }}>
        <Map center={center} meCoords={me || undefined} pins={pins} zoom={14} focusOn={selected || undefined} />

        {/* Floating recenter button */}
        <button
          onClick={() => getCurrentLocation().then((c) => { setMe(c); setMeDenied(false); }).catch(() => setMeDenied(true))}
          className="absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-bg/95 border border-stroke grid place-items-center text-text-muted backdrop-blur"
          title="Recenter"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        </button>
      </div>

      {/* Truck list */}
      <div className="mt-4 flex items-center justify-between px-4">
        <h2 className="text-sm font-bold">
          {trucks === null
            ? 'Loading…'
            : `${filtered.length} truck${filtered.length === 1 ? '' : 's'} live nearby`}
        </h2>
        <button
          onClick={() => setSort(sort === 'closest' ? 'rated' : 'closest')}
          className="chip"
        >
          {sort === 'closest' ? 'Closest' : 'Top rated'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>

      {trucks === null && (
        <div className="flex flex-col gap-2 mt-3 px-4">
          {[0,1,2].map((i) => (
            <div key={i} className="card p-3 flex items-center gap-3 animate-pulse">
              <div className="w-14 h-14 rounded-lg bg-surface-2" />
              <div className="flex-1">
                <div className="h-3 bg-surface-2 rounded w-3/4" />
                <div className="h-2 bg-surface-2 rounded w-1/2 mt-2" />
                <div className="h-2 bg-surface-2 rounded w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {trucks !== null && filtered.length === 0 && (
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl mx-auto mb-3">📡</div>
          <div className="font-bold">
            {filter === 'all' ? 'No live trucks right now' : `No ${filter} trucks live`}
          </div>
          <div className="text-text-muted text-sm mt-1">
            {filter === 'all'
              ? 'Once owners tap Go Live, they\'ll appear here.'
              : 'Try a different cuisine or check back soon.'}
          </div>
        </div>
      )}

      <div className="mt-2">
        {filtered.map((t) => {
          const active = t.id === selected;
          return (
            <div
              key={t.id}
              className={`px-4 py-3 border-b border-stroke flex items-center gap-3 ${active ? 'bg-accent/5' : ''}`}
            >
              <button
                onClick={() => setSelected(t.id)}
                className="w-14 h-14 rounded-lg bg-surface-2 overflow-hidden grid place-items-center text-xl flex-shrink-0"
                aria-label="Focus on map"
              >
                {t.logo_url ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" /> : '🚚'}
              </button>
              <button
                onClick={() => setSelected(t.id)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="text-sm font-bold truncate flex items-center gap-2">
                  {t.name}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent">LIVE</span>
                  {movedRecently(t) && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success/15 text-success">MOVING</span>
                  )}
                </div>
                <div className="text-[11px] text-text-muted capitalize truncate">
                  {t.cuisine}
                  {t.miles != null && <> · {t.miles.toFixed(1)} mi · 🚶 {walkMinutes(t.miles)} min</>}
                  {t.rating_count > 0 && <> · ⭐ {t.rating.toFixed(1)}</>}
                </div>
              </button>
              <div className="flex flex-col gap-1">
                <Link href={`/truck/${t.id}`} className="btn sm primary">View</Link>
                {t.location && (
                  <button
                    className="btn sm"
                    onClick={() => openDirections(t.location!.latitude, t.location!.longitude, t.name)}
                  >📍</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
