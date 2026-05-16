'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { ItemDetailSheet } from '@/components/ItemDetailSheet';
import { subscribeTruck } from '@/lib/trucks';
import { groupBySection, subscribeMenu } from '@/lib/menu';
import { subscribeReviews } from '@/lib/reviews';
import { follow, isFollowing, unfollow } from '@/lib/follows';
import { addToCart, useCart } from '@/lib/cart';
import { useAuth } from '@/lib/auth';
import { distanceMiles, getCurrentLocation, openDirections, Coords } from '@/lib/location';
import { showToast, ToastHost } from '@/components/Toast';
import type { FoodTruck, MenuItem, Review, DietaryTag } from '@/lib/types';
import { dollars, relativeTime } from '@/lib/utils';

const TAG_SHORT: Record<DietaryTag, string> = {
  vegan: 'V', vegetarian: 'VG', gluten_free: 'GF', spicy: '🌶',
  halal: 'H', kosher: 'K', dairy_free: 'DF', nut_free: 'NF',
};

function walkMinutes(miles: number) {
  return Math.max(1, Math.round(miles * 20));
}

export default function TruckPage() {
  return (
    <RoleGuard allow={['customer', 'owner']}>
      <TruckPageInner />
      <ToastHost />
    </RoleGuard>
  );
}

function TruckPageInner() {
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  return (
    <>
      <Truck isPreview={isOwner} />
      {isOwner ? <OwnerNav /> : <CustomerNav />}
    </>
  );
}

function Truck({ isPreview = false }: { isPreview?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [truck, setTruck] = useState<FoodTruck | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [following, setFollowing] = useState(false);
  const [me, setMe] = useState<Coords | null>(null);
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const cart = useCart();

  useEffect(() => {
    if (!id) return;
    const u1 = subscribeTruck(id, setTruck);
    const u2 = subscribeMenu(id, setItems);
    const u3 = subscribeReviews(id, setReviews);
    return () => { u1(); u2(); u3(); };
  }, [id]);

  useEffect(() => { getCurrentLocation().then(setMe).catch(() => {}); }, []);

  useEffect(() => {
    if (isPreview) return;
    if (user && id) isFollowing(user.uid, id).then(setFollowing);
  }, [user, id, isPreview]);

  const groups = useMemo(() => groupBySection(items), [items]);

  // Rating breakdown: counts per star
  const ratingBreakdown = useMemo(() => {
    const c = [0, 0, 0, 0, 0]; // index 0 = 1 star … index 4 = 5 stars
    reviews.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) c[r.rating - 1]++; });
    return c;
  }, [reviews]);

  // Photos: menu item photos + later review photos (placeholder for now)
  const photos = useMemo(() => {
    const out: string[] = [];
    items.forEach((it) => { if (it.photo_url) out.push(it.photo_url); });
    return out.slice(0, 9);
  }, [items]);

  async function toggleFollow() {
    if (!user || !id) return;
    if (following) { await unfollow(user.uid, id); setFollowing(false); showToast('Unfollowed'); }
    else { await follow(user.uid, id); setFollowing(true); showToast(`Following ${truck?.name} — you’ll be notified when they go live`); }
  }

  function onAddFromSheet(qty: number, notes: string) {
    if (!truck || !sheetItem) return;
    if (isPreview) { showToast('Preview mode — customers add to cart here'); setSheetItem(null); return; }
    if (cart && cart.truck_id !== truck.id) {
      const ok = confirm(`Your cart has items from ${cart.truck_name}. Replace it with items from ${truck.name}?`);
      if (!ok) return;
    }
    addToCart(truck.id, truck.name, {
      menu_item_id: sheetItem.id,
      name: sheetItem.name,
      unit_price_cents: sheetItem.price_cents,
      qty,
      photo_url: sheetItem.photo_url,
      notes: notes || undefined,
      prep_minutes: sheetItem.prep_minutes,
    });
    showToast(`${sheetItem.name} added`);
    setSheetItem(null);
  }

  if (!truck) {
    return (
      <div className="min-h-screen max-w-md mx-auto page-enter">
        {/* Skeleton */}
        <div className="h-52 bg-surface-2 animate-pulse" />
        <div className="px-5 mt-4 animate-pulse">
          <div className="h-6 bg-surface-2 rounded w-3/5" />
          <div className="h-3 bg-surface-2 rounded w-1/3 mt-2" />
        </div>
      </div>
    );
  }

  const miles = me && truck.location ? distanceMiles(me, { lat: truck.location.latitude, lng: truck.location.longitude }) : null;
  const cartCount = cart && cart.truck_id === truck.id ? cart.lines.reduce((s, l) => s + l.qty, 0) : 0;
  const cartSubtotal = cart && cart.truck_id === truck.id ? cart.lines.reduce((s, l) => s + l.unit_price_cents * l.qty, 0) : 0;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-32 page-enter">
      {/* Banner */}
      <div className="relative h-52 bg-surface-2 overflow-hidden">
        {truck.cover_url
          ? <img src={truck.cover_url} alt="" className="w-full h-full object-cover" />
          : truck.logo_url
            ? <img src={truck.logo_url} alt="" className="w-full h-full object-cover blur-xl scale-110 opacity-70" />
            : <div className="w-full h-full grid place-items-center text-6xl">🚚</div>}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-bg" />
        <button onClick={() => router.back()} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-bg/70 border border-stroke grid place-items-center backdrop-blur">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button
          onClick={() => {
            if (navigator.share) navigator.share({ title: truck.name, url: window.location.href }).catch(() => {});
            else { navigator.clipboard?.writeText(window.location.href); showToast('Link copied'); }
          }}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-bg/70 border border-stroke grid place-items-center backdrop-blur"
          aria-label="Share"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14"/></svg>
        </button>
      </div>

      <div className="px-5 -mt-10 relative">
        <div className="flex items-end gap-3">
          <div className="w-20 h-20 rounded-2xl bg-surface border-2 border-bg overflow-hidden grid place-items-center text-3xl shadow-lg flex-shrink-0">
            {truck.logo_url ? <img src={truck.logo_url} alt="" className="w-full h-full object-cover" /> : '🚚'}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {truck.is_live && (
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent text-white flex items-center gap-1">
                  <span className="live-dot" /> LIVE
                </span>
              )}
              {!truck.is_open && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-text-muted">CLOSED</span>}
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold mt-3 tracking-tight">{truck.name}</h1>
        <div className="text-sm text-text-muted mt-1 capitalize">{truck.cuisine} truck</div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-text-muted">
          {truck.rating_count > 0 && (
            <span>⭐ <span className="text-white font-semibold">{truck.rating.toFixed(1)}</span> <span className="text-text-faint">({truck.rating_count})</span></span>
          )}
          {miles != null && <span>📍 <span className="text-white font-semibold">{miles.toFixed(1)} mi</span> · 🚶 {walkMinutes(miles)} min</span>}
          {truck.is_live && <span>⏱ ~12 min wait</span>}
          <span><span className="text-white font-semibold">{truck.follower_count}</span> followers</span>
        </div>

        {truck.description && <p className="text-sm text-text-muted mt-3 leading-relaxed">{truck.description}</p>}
        {truck.hours && <div className="text-xs text-text-muted mt-2"><b className="text-white">Hours:</b> {truck.hours}</div>}
        {truck.address && <div className="text-xs text-text-muted mt-1"><b className="text-white">Parked at:</b> {truck.address}</div>}

        {!isPreview && (
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <button onClick={toggleFollow} className={`btn ${following ? 'ghost' : 'primary'}`}>
              {following ? '🔔 Following — we’ll alert you' : '+ Follow & get live alerts'}
            </button>
            {truck.location && (
              <button
                onClick={() => openDirections(truck.location!.latitude, truck.location!.longitude, truck.name)}
                className="btn"
                aria-label="Get directions"
              >📍 Directions</button>
            )}
          </div>
        )}
        {isPreview && (
          <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning text-center font-bold tracking-widest uppercase">
            Owner preview · what customers see
          </div>
        )}
      </div>

      {truck.is_live && (
        <div className="mx-5 mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 flex items-center gap-3">
          <span className="live-dot" />
          <div>
            <div className="text-sm font-semibold">Live right now</div>
            <div className="text-[11px] text-text-muted">{miles != null ? `${miles.toFixed(1)} miles away · 🚶 ${walkMinutes(miles)} min walk` : 'Tap pin on the map for location'}</div>
          </div>
        </div>
      )}

      {truck.promotion && (
        <div className="mx-5 mt-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm flex items-center gap-3">
          <span className="text-warning font-bold">PROMO</span>
          <span>{truck.promotion}</span>
        </div>
      )}

      {/* Menu — grouped by section */}
      {items.length === 0 ? (
        <div className="px-5 mt-6 text-sm text-text-muted">No menu items yet.</div>
      ) : (
        groups.map((g) => (
          <div key={g.section} className="mt-6">
            <h2 className="px-5 text-xs uppercase tracking-widest text-text-muted font-bold">{g.section}</h2>
            <div className="mt-2">
              {g.items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => !it.sold_out && setSheetItem(it)}
                  disabled={it.sold_out}
                  className="w-full text-left px-5 py-3 border-b border-stroke flex gap-3 items-center disabled:opacity-55 active:bg-surface"
                >
                  <div className="w-20 h-20 rounded-xl bg-surface-2 overflow-hidden flex-shrink-0 relative">
                    {it.photo_url ? <img src={it.photo_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-2xl">🍽️</div>}
                    {it.sold_out && (
                      <div className="absolute inset-0 bg-black/65 grid place-items-center">
                        <span className="text-[10px] font-extrabold tracking-widest">SOLD OUT</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{it.name}</div>
                    {it.description && <div className="text-xs text-text-muted line-clamp-2 mt-0.5">{it.description}</div>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold">{dollars(it.price_cents)}</span>
                      {it.prep_minutes ? <span className="text-[10px] text-text-muted">· {it.prep_minutes} min</span> : null}
                      {it.tags && it.tags.length > 0 && (
                        <span className="flex gap-1">
                          {it.tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-2 text-text-muted">{TAG_SHORT[t]}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  {!it.sold_out && (
                    <span className="w-9 h-9 rounded-full bg-accent grid place-items-center text-white font-bold text-lg flex-shrink-0 shadow-lg shadow-accent/30">+</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="mt-6">
          <h2 className="px-5 text-xs uppercase tracking-widest text-text-muted font-bold">Photos</h2>
          <div className="grid grid-cols-3 gap-1 mt-2 px-5">
            {photos.map((p, i) => (
              <div key={i} className="aspect-square bg-surface-2 overflow-hidden rounded-md">
                <img src={p} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <h2 className="px-5 mt-8 text-xs uppercase tracking-widest text-text-muted font-bold flex items-center justify-between">
        <span>Reviews</span>
        {truck.rating_count > 0 && (
          <span className="text-white normal-case font-bold tracking-normal">⭐ {truck.rating.toFixed(1)} <span className="text-text-faint">({truck.rating_count})</span></span>
        )}
      </h2>

      {/* Rating breakdown */}
      {reviews.length > 0 && (
        <div className="px-5 mt-3 card p-4 flex gap-4">
          <div className="text-center min-w-[60px]">
            <div className="text-3xl font-extrabold">{truck.rating.toFixed(1)}</div>
            <div className="text-[10px] text-text-muted">{reviews.length} reviews</div>
          </div>
          <div className="flex-1 flex flex-col gap-1 justify-center">
            {[5,4,3,2,1].map((stars) => {
              const n = ratingBreakdown[stars - 1] || 0;
              const pct = reviews.length ? (n / reviews.length) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-[11px]">
                  <span className="w-3 text-text-muted">{stars}</span>
                  <span className="text-text-faint">⭐</span>
                  <span className="flex-1 h-1.5 rounded bg-surface-2 overflow-hidden">
                    <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-text-muted w-5 text-right">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="px-5 mt-3 text-sm text-text-muted">No reviews yet. Be the first after your next pickup!</div>
      ) : (
        <div className="px-5 mt-3 flex flex-col gap-3">
          {reviews.slice(0, 5).map((r) => (
            <div key={r.id} className="card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-sm truncate">{r.customer_name}</div>
                <div className="text-xs">{'⭐'.repeat(r.rating)}</div>
              </div>
              <div className="text-[11px] text-text-muted">{relativeTime(r.created_at)}</div>
              {r.body && <p className="text-sm mt-2 leading-snug">{r.body}</p>}
              {r.owner_reply && (
                <div className="mt-2 rounded-lg bg-surface-2 border border-stroke px-3 py-2">
                  <div className="text-[10px] text-accent font-bold uppercase tracking-widest mb-0.5">
                    {truck.name} replied
                  </div>
                  <div className="text-sm leading-snug">{r.owner_reply}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="h-4" />

      {!isPreview && cartCount > 0 && (
        <div className="fixed left-0 right-0 bottom-[72px] z-30 max-w-md mx-auto px-4 pb-2 pointer-events-none">
          <Link href="/cart" className="btn primary block pointer-events-auto shadow-xl shadow-accent/30 flex justify-between">
            <span>View cart · {cartCount} item{cartCount > 1 ? 's' : ''}</span>
            <span className="font-bold">{dollars(cartSubtotal)}</span>
          </Link>
        </div>
      )}

      <ItemDetailSheet
        item={sheetItem}
        truckName={truck.name}
        onClose={() => setSheetItem(null)}
        onAdd={onAddFromSheet}
      />
    </div>
  );
}
