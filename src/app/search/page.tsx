'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { getAllTrucks } from '@/lib/trucks';
import { listMenu } from '@/lib/menu';
import type { FoodTruck, MenuItem } from '@/lib/types';
import { Spinner } from '@/components/Spinner';
import { dollars } from '@/lib/utils';

export default function SearchPage() {
  return (
    <RoleGuard allow={['customer']}>
      <Search />
      <CustomerNav />
    </RoleGuard>
  );
}

interface Hit {
  type: 'truck' | 'dish';
  truck: FoodTruck;
  item?: MenuItem;
}

function Search() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [trucks, setTrucks] = useState<FoodTruck[] | null>(null);
  const [dishIndex, setDishIndex] = useState<{ item: MenuItem; truck: FoodTruck }[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getAllTrucks()
      .then((t) => { setTrucks(t); setErr(null); })
      .catch((e) => { setTrucks([]); setErr(e?.message || 'Search index unavailable'); });
  }, []);

  useEffect(() => {
    if (!trucks || trucks.length === 0) return;
    let cancelled = false;
    setLoadingDishes(true);
    (async () => {
      const out: { item: MenuItem; truck: FoodTruck }[] = [];
      for (const t of trucks) {
        try {
          const items = await listMenu(t.id);
          for (const it of items) out.push({ item: it, truck: t });
        } catch {}
      }
      if (!cancelled) {
        setDishIndex(out);
        setLoadingDishes(false);
      }
    })();
    return () => { cancelled = true; };
  }, [trucks?.length]);

  const results = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const hits: Hit[] = [];
    const seenTrucks = new Set<string>();
    (trucks || []).forEach((t) => {
      const blob = [t.name, t.cuisine, t.description].join(' ').toLowerCase();
      if (blob.includes(needle)) {
        hits.push({ type: 'truck', truck: t });
        seenTrucks.add(t.id);
      }
    });
    dishIndex.forEach(({ item, truck }) => {
      const blob = [item.name, item.description, item.section].join(' ').toLowerCase();
      if (blob.includes(needle)) {
        hits.push({ type: 'dish', truck, item });
      }
    });
    return hits.slice(0, 60);
  }, [q, trucks, dishIndex]);

  // Default browse: live trucks first, then any others
  const browse = useMemo(() => {
    if (!trucks) return [];
    return [...trucks].sort((a, b) => {
      if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
      return (b.rating ?? 0) - (a.rating ?? 0);
    }).slice(0, 30);
  }, [trucks]);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-4 py-3 flex items-center gap-2">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex-1 relative">
          <input
            autoFocus
            className="input pl-10"
            placeholder="Search trucks, dishes, cuisines…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">Clear</button>
          )}
        </div>
      </header>

      {trucks === null && (
        <div className="p-10 grid place-items-center"><Spinner /></div>
      )}

      {err && trucks !== null && trucks.length === 0 && (
        <div className="p-8 text-center text-sm text-accent">{err}</div>
      )}

      {/* No query → show browse list */}
      {trucks !== null && !q && (
        <>
          {browse.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl mx-auto mb-3">🚚</div>
              <div className="font-bold">No trucks listed yet</div>
              <div className="text-text-muted text-sm mt-1">Trucks will appear here as they sign up.</div>
            </div>
          ) : (
            <>
              <div className="px-5 mt-4 mb-2 text-xs uppercase tracking-widest text-text-muted font-bold">
                Browse all trucks {loadingDishes && <span className="text-text-faint normal-case tracking-normal ml-2">· indexing dishes…</span>}
              </div>
              {browse.map((t) => (
                <Link key={t.id} href={`/truck/${t.id}`} className="flex items-center gap-3 px-5 py-3 border-b border-stroke">
                  <div className="w-14 h-14 rounded-lg bg-surface-2 overflow-hidden flex-shrink-0">
                    {t.logo_url ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-2xl">🚚</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate flex items-center gap-2">
                      {t.name}
                      {t.is_live && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent">LIVE</span>}
                    </div>
                    <div className="text-xs text-text-muted truncate capitalize">{t.cuisine}{t.rating_count > 0 ? ` · ⭐ ${t.rating.toFixed(1)}` : ''}</div>
                  </div>
                  <span className="text-text-faint">›</span>
                </Link>
              ))}
            </>
          )}
        </>
      )}

      {/* Query → show results */}
      {q && results.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl mx-auto mb-3">🔍</div>
          <div className="font-bold">No results for "{q}"</div>
          <div className="text-text-muted text-sm mt-1">Try a shorter or different term.</div>
        </div>
      )}

      <div>
        {q && results.map((h, idx) => (
          <Link
            key={`${h.type}-${h.truck.id}-${h.item?.id || ''}-${idx}`}
            href={`/truck/${h.truck.id}`}
            className="flex items-center gap-3 px-5 py-3 border-b border-stroke"
          >
            <div className="w-14 h-14 rounded-lg bg-surface-2 overflow-hidden flex-shrink-0">
              {h.type === 'dish' && h.item?.photo_url
                ? <img src={h.item.photo_url} alt="" className="w-full h-full object-cover" />
                : h.truck.logo_url
                  ? <img src={h.truck.logo_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full grid place-items-center text-2xl">{h.type === 'dish' ? '🍽️' : '🚚'}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {h.type === 'dish' ? h.item!.name : h.truck.name}
              </div>
              <div className="text-xs text-text-muted truncate capitalize">
                {h.type === 'dish'
                  ? <>{h.truck.name} · {dollars(h.item!.price_cents)}</>
                  : <>{h.truck.cuisine} truck{h.truck.is_live ? ' · LIVE' : ''}</>}
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-faint font-bold">{h.type}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
