'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { subscribeLiveTrucks, getAllTrucks } from '@/lib/trucks';
import type { FoodTruck } from '@/lib/types';
import { BrandMark } from '@/components/BrandMark';

/**
 * Public landing page.
 * - Signed-out → marketing site with live counts + featured trucks
 * - Signed-in → routed to their role-specific home (customer / owner)
 */
export default function LandingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [live, setLive] = useState<FoodTruck[] | null>(null);
  const [allTrucks, setAllTrucks] = useState<FoodTruck[]>([]);

  // Always subscribe to live trucks (used in the hero stat + featured rail)
  useEffect(() => subscribeLiveTrucks(setLive), []);

  // For "Featured" — top rated across the whole platform
  useEffect(() => {
    getAllTrucks().then((arr) => {
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      setAllTrucks(arr.slice(0, 6));
    }).catch(() => {});
  }, []);

  // Redirect signed-in users to their dashboard
  useEffect(() => {
    if (loading) return;
    if (!user || !profile) return;
    router.replace(profile.role === 'owner' ? (profile.truck_id ? '/dashboard' : '/setup') : '/home');
  }, [user, profile, loading, router]);

  const liveCount = live?.length ?? 0;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-stroke">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
          <BrandMark size={36} />
          <span className="font-extrabold text-lg tracking-tight">WYA</span>
          <span className="ml-auto" />
          <Link href="/login" className="text-sm font-semibold text-text-muted hover:text-white">Sign in</Link>
          <Link href="/signup" className="btn sm primary">Sign up</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Decorative neon glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-[#4D86FF]/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-5 pt-14 pb-12 md:pt-20 md:pb-20 grid md:grid-cols-2 gap-8 items-center">
          <div>
            {/* Live indicator pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/30 px-3 py-1 text-xs font-bold text-accent">
              <span className="live-dot" />
              {live === null
                ? 'Connecting…'
                : liveCount > 0
                  ? `${liveCount} truck${liveCount === 1 ? '' : 's'} live right now`
                  : 'New trucks joining every day'}
            </div>

            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Find live food trucks <span className="text-accent">near you</span>.
            </h1>
            <p className="mt-5 text-lg text-text-muted leading-relaxed max-w-md">
              WYA shows you every food truck currently parked nearby — on a live map, with menus, ratings, and pickup ordering.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link href="/signup?role=customer" className="btn primary">🍔 Find food</Link>
              <Link href="/signup?role=owner" className="btn ghost">🚚 List my truck</Link>
            </div>

            <p className="mt-4 text-xs text-text-faint">
              Free to join · Apple Pay &amp; card via Stripe · Or pay cash at the truck.
            </p>
          </div>

          {/* Hero visual — stacked truck cards with floating live pin */}
          <HeroVisual trucks={live ?? []} />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-5 py-14 md:py-20">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">How WYA works</h2>
        <p className="mt-3 text-text-muted">From craving to pickup in three taps.</p>

        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {[
            { n: '01', t: 'Open the live map', b: 'See every food truck parked within a mile of you, updating in real time as they move.' },
            { n: '02', t: 'Tap, browse, order', b: 'Open a truck profile → menu → add to cart → pay with card or pay cash at the truck.' },
            { n: '03', t: 'Skip the line', b: 'Watch the live order tracker. Show your pickup code at the window and grab your food.' },
          ].map((step) => (
            <div key={step.n} className="card p-6">
              <div className="text-accent font-extrabold text-2xl">{step.n}</div>
              <div className="text-lg font-bold mt-2">{step.t}</div>
              <div className="text-sm text-text-muted mt-2 leading-relaxed">{step.b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED TRUCKS */}
      {allTrucks.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 py-10 md:py-14">
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Featured trucks</h2>
              <p className="mt-2 text-text-muted">A few of our top-rated vendors right now.</p>
            </div>
            <Link href="/signup?role=customer" className="hidden md:inline text-sm font-semibold text-accent">See them all →</Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {allTrucks.slice(0, 6).map((t) => (
              <div key={t.id} className="card overflow-hidden">
                <div className="aspect-[4/3] bg-surface-2 relative">
                  {t.logo_url
                    ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full grid place-items-center text-5xl">🚚</div>}
                  {t.is_live && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent text-white flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-bold truncate">{t.name}</div>
                  <div className="text-xs text-text-muted capitalize">
                    {t.cuisine}
                    {t.rating_count > 0 && <> · ⭐ {t.rating.toFixed(1)}</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOR TRUCK OWNERS */}
      <section className="max-w-6xl mx-auto px-5 py-14 md:py-20">
        <div className="rounded-2xl border border-stroke bg-gradient-to-br from-accent/10 via-bg to-bg p-8 md:p-12 grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/30 px-3 py-1 text-xs font-bold text-accent uppercase tracking-widest">
              For truck owners
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">
              Stop posting your location on Instagram.
            </h2>
            <p className="mt-4 text-text-muted leading-relaxed">
              Tap <b className="text-white">Go Live</b> and every customer following you, plus everyone within a mile, sees your truck on the map in seconds. No more lost regulars.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-text-muted">
              <li>✓ One-tap go-live with auto location tracking</li>
              <li>✓ Take card payments via Stripe — money lands in your bank</li>
              <li>✓ Edit your menu, mark items sold out, manage orders</li>
              <li>✓ Real-time analytics — revenue, peak hours, repeat customers</li>
              <li>✓ 5% platform fee. No monthly cost.</li>
            </ul>
            <div className="mt-7">
              <Link href="/signup?role=owner" className="btn primary">List my truck — free</Link>
            </div>
          </div>

          {/* Phone mock */}
          <div className="relative mx-auto md:mx-0 hidden md:block">
            <div className="w-64 h-[440px] rounded-[36px] bg-black border border-stroke-2 p-2 shadow-2xl">
              <div className="w-full h-full rounded-[28px] bg-gradient-to-br from-accent/20 to-bg overflow-hidden p-5 flex flex-col">
                <div className="text-xs text-text-muted">Tony's Tacos</div>
                <div className="text-lg font-bold flex items-center gap-2 mt-0.5">
                  <span className="live-dot" /> You are LIVE
                </div>
                <div className="text-xs text-text-muted mt-1">McCarren Park · updated just now</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="bg-surface/70 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-text-muted uppercase tracking-widest">Today</div>
                    <div className="font-extrabold text-base mt-0.5">$1,842</div>
                  </div>
                  <div className="bg-surface/70 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-text-muted uppercase tracking-widest">Orders</div>
                    <div className="font-extrabold text-base mt-0.5">98</div>
                  </div>
                </div>
                <div className="mt-4 text-[10px] uppercase tracking-widest text-text-muted">Active queue</div>
                <div className="mt-2 space-y-1.5">
                  <div className="bg-surface/70 rounded-md px-2 py-1.5 text-xs flex justify-between">
                    <span className="truncate">Maya · birria + horchata</span><span className="text-accent">Prep</span>
                  </div>
                  <div className="bg-surface/70 rounded-md px-2 py-1.5 text-xs flex justify-between">
                    <span className="truncate">Jordan · 2× tacos</span><span className="text-success">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CITY ACTIVITY */}
      <section className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-3 gap-4">
        <Stat label="Trucks live now" value={liveCount} accent />
        <Stat label="Trucks total" value={allTrucks.length || '—'} />
        <Stat label="Avg pickup time" value="12 min" />
      </section>

      {/* CTA BAND */}
      <section className="max-w-6xl mx-auto px-5 py-12">
        <div className="rounded-2xl border border-stroke bg-surface p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Ready to find food?</h2>
          <p className="mt-2 text-text-muted">It takes 30 seconds to sign up.</p>
          <div className="mt-5 flex justify-center gap-3 flex-wrap">
            <Link href="/signup?role=customer" className="btn primary">Find food near me</Link>
            <Link href="/signup?role=owner" className="btn ghost">List my truck</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-stroke">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center gap-3 text-xs text-text-faint">
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="font-bold">WYA</span>
            <span className="text-text-faint">— Where you at?</span>
          </div>
          <span className="md:ml-auto">© {new Date().getFullYear()} WYA</span>
          <Link href="/login" className="hover:text-white">Sign in</Link>
          <Link href="/signup" className="hover:text-white">Sign up</Link>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-text-muted uppercase tracking-widest font-bold">{label}</div>
      <div className={`text-4xl font-extrabold mt-2 ${accent ? 'text-accent' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function HeroVisual({ trucks }: { trucks: FoodTruck[] }) {
  // Show up to 3 real trucks if we have them; otherwise show generic teaser cards.
  const sample = trucks.slice(0, 3);
  const fallback = [
    { id: 'a', name: "Tony's Tacos", cuisine: 'mexican', rating: 4.9, color: '#FF3B7F', emoji: '🌮' },
    { id: 'b', name: 'Seoul Steam',  cuisine: 'korean',  rating: 4.7, color: '#3DDC97', emoji: '🍱' },
    { id: 'c', name: 'Halal King',   cuisine: 'halal',   rating: 4.8, color: '#FFB020', emoji: '🥙' },
  ];
  const cards = sample.length > 0
    ? sample.map((t, i) => ({ id: t.id, name: t.name, cuisine: t.cuisine, rating: t.rating || 0, color: ['#FF3B7F','#3DDC97','#FFB020'][i] || '#FF3B7F', logo: t.logo_url }))
    : fallback;

  return (
    <div className="relative h-[420px] md:h-[460px]">
      {/* Faux map background */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0F1117] via-bg to-bg border border-stroke overflow-hidden">
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Pulse pins */}
        <span className="absolute top-[35%] left-[28%] w-3 h-3 rounded-full bg-accent shadow-[0_0_0_6px_rgba(255,59,127,0.2)]" />
        <span className="absolute top-[55%] left-[60%] w-3 h-3 rounded-full bg-success shadow-[0_0_0_6px_rgba(61,220,151,0.2)]" />
        <span className="absolute top-[20%] left-[70%] w-3 h-3 rounded-full bg-warning shadow-[0_0_0_6px_rgba(255,176,32,0.2)]" />
      </div>

      {/* Stacked truck cards */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2">
        {cards.map((c: any, i) => (
          <div
            key={c.id}
            className="rounded-xl bg-surface/95 backdrop-blur border border-stroke p-3 flex items-center gap-3"
            style={{ transform: `translateX(${i * 8}px)` }}
          >
            <div className="w-12 h-12 rounded-lg grid place-items-center text-xl flex-shrink-0 overflow-hidden"
                 style={{ background: c.color }}>
              {c.logo ? <img src={c.logo} alt="" className="w-full h-full object-cover" /> : (c.emoji || '🚚')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{c.name}</div>
              <div className="text-[11px] text-text-muted capitalize truncate">
                {c.cuisine}{c.rating > 0 && <> · ⭐ {c.rating.toFixed(1)}</>}
              </div>
            </div>
            <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent">LIVE</span>
          </div>
        ))}
      </div>
    </div>
  );
}
