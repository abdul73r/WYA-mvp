'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { AlertsBell, CustomerNav } from '@/components/CustomerNav';
import { Spinner } from '@/components/Spinner';
import { getAllTrucks } from '@/lib/trucks';
import { getCurrentLocation, distanceMiles, Coords } from '@/lib/location';
import type { FoodTruck, CuisineTag } from '@/lib/types';

const META: Record<string, { label: string; emoji: string; hero: string }> = {
  mexican:  { label: 'Mexican', emoji: '🌮', hero: 'Tacos, burritos, birria and more.' },
  korean:   { label: 'Korean', emoji: '🍱', hero: 'Bulgogi bowls, bibimbap, Korean BBQ.' },
  halal:    { label: 'Halal', emoji: '🥙', hero: 'Chicken over rice, gyros, kebabs.' },
  burgers:  { label: 'Burgers', emoji: '🍔', hero: 'Smash burgers, classic burgers, fries.' },
  seafood:  { label: 'Seafood', emoji: '🦞', hero: 'Lobster rolls, fish tacos, shrimp baskets.' },
  desserts: { label: 'Desserts', emoji: '🍦', hero: 'Ice cream, pastries, sweet treats.' },
  vegan:    { label: 'Vegan', emoji: '🥗', hero: 'Plant-based bowls and wraps.' },
  pizza:    { label: 'Pizza', emoji: '🍕', hero: 'Slice trucks and wood-fired pies.' },
  bbq:      { label: 'BBQ', emoji: '🍖', hero: 'Brisket, ribs, pulled pork.' },
  other:    { label: 'All other', emoji: '🍽️', hero: 'Everything else worth eating.' },
};

export default function CuisinePage() {
  return (
    <RoleGuard allow={['customer']}>
      <Cuisine />
      <CustomerNav />
    </RoleGuard>
  );
}

function Cuisine() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const slug = (name || '').toLowerCase();
  const meta = META[slug] || { label: slug, emoji: '🍽️', hero: '' };
  const [trucks, setTrucks] = useState<FoodTruck[] | null>(null);
  const [me, setMe] = useState<Coords | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);

  useEffect(() => {
    getAllTrucks().then(setTrucks).catch(() => setTrucks([]));
  }, []);
  useEffect(() => { getCurrentLocation().then(setMe).catch(() => {}); }, []);

  const list = useMemo(() => {
    const all = (trucks || []).filter((t) => t.cuisine === slug);
    const filtered = all.filter((t) => {
      if (openOnly && !t.is_open) return false;
      if (liveOnly && !t.is_live) return false;
      return true;
    });
    return filtered.map((t) => {
      const miles = me && t.location ? distanceMiles(me, { lat: t.location.latitude, lng: t.location.longitude }) : null;
      return { ...t, miles } as FoodTruck & { miles: number | null };
    }).sort((a, b) => (a.miles ?? 999) - (b.miles ?? 999));
  }, [trucks, slug, me, openOnly, liveOnly]);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-2">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <h1 className="text-lg font-bold flex-1 capitalize">{meta.label}</h1>
        <Link href="/search" className="w-10 h-10 rounded-full bg-surface border border-stroke grid place-items-center" aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
        </Link>
        <AlertsBell />
      </header>

      {/* Hero */}
      <div className="px-5 mt-5">
        <div className="rounded-2xl border border-stroke bg-gradient-to-br from-accent/15 to-surface p-6">
          <div className="text-5xl">{meta.emoji}</div>
          <h2 className="text-2xl font-extrabold mt-3">{meta.label} trucks near you</h2>
          {meta.hero && <p className="text-sm text-text-muted mt-1">{meta.hero}</p>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-5 mt-4 overflow-x-auto no-scrollbar">
        <button onClick={() => setLiveOnly(!liveOnly)} className={`chip ${liveOnly ? 'active' : ''}`}>
          {liveOnly ? '✓ ' : ''}🔴 Live now
        </button>
        <button onClick={() => setOpenOnly(!openOnly)} className={`chip ${openOnly ? 'active' : ''}`}>
          {openOnly ? '✓ ' : ''}🟢 Open
        </button>
      </div>

      {/* List */}
      {trucks === null ? (
        <div className="p-10 grid place-items-center"><Spinner /></div>
      ) : list.length === 0 ? (
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl mx-auto mb-3">{meta.emoji}</div>
          <div className="font-bold">No {meta.label.toLowerCase()} trucks yet</div>
          <div className="text-text-muted text-sm mt-1">Check back soon — new trucks join every week.</div>
        </div>
      ) : (
        <div className="mt-4">
          {list.map((t) => (
            <Link key={t.id} href={`/truck/${t.id}`} className="px-5 py-3 border-b border-stroke flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-surface-2 overflow-hidden grid place-items-center text-2xl flex-shrink-0">
                {t.logo_url ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" /> : '🚚'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate flex items-center gap-2">
                  {t.name}
                  {t.is_live && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent">LIVE</span>}
                  {!t.is_open && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-text-muted">CLOSED</span>}
                </div>
                <div className="text-xs text-text-muted mt-0.5 truncate">
                  {t.miles != null && <>{t.miles.toFixed(1)} mi</>}
                  {t.rating_count > 0 && <> · ⭐ {t.rating.toFixed(1)} ({t.rating_count})</>}
                </div>
              </div>
              <span className="text-text-faint">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
