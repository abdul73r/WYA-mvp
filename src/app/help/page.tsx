'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const FAQS: { q: string; a: string }[] = [
  { q: 'How do I find a food truck?',
    a: 'Open the Map tab — every truck currently parked nearby and broadcasting their location shows up as a live pin. Tap a pin to see the menu and order.' },
  { q: 'Do I have to pay through the app?',
    a: 'No. At checkout you pick "Pay with card" (handled by Stripe) or "Pay at the truck" (cash or card in person when you pick up).' },
  { q: 'What is the pickup code?',
    a: 'Every order gets a 4-digit code. Show it to the truck when you pick up — the owner enters it to confirm they handed off the right order to the right person.' },
  { q: 'Can I cancel my order?',
    a: 'Only before the truck accepts it. Once they accept, you have to contact the truck directly. If you paid by card, cancelling triggers an automatic refund through Stripe.' },
  { q: 'How fast will my food be ready?',
    a: 'Each menu item has a prep time. Your cart shows the longest one as your estimated wait. You\'ll also get a push when the truck marks your order ready.' },
  { q: 'What if a truck disappears from the map?',
    a: 'They either tapped Go Offline or they stopped updating their location. We hide trucks that haven\'t pinged their location in over 8 hours.' },
  { q: 'How do I leave a review?',
    a: 'After the truck marks your order picked up, your order detail shows a "Rate this order" button. You can leave a star rating and a written review.' },
  { q: 'I\'m a truck owner — how do I get paid?',
    a: 'Sign up as a truck owner, connect Stripe in your Wallet, complete onboarding (about 5 minutes), then customer card payments land in your Stripe balance. Tap Transfer in your Wallet to send to your bank.' },
  { q: 'What does WYA take as a fee?',
    a: 'WYA keeps 5% of each order. The rest — including all tip and tax — goes directly to the truck.' },
  { q: 'Is my location private?',
    a: 'Your location is used to find nearby trucks and is never stored or shared. Truck owners only see your name, order, and pickup code — not your location.' },
];

export default function HelpPage() {
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-16 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 className="text-lg font-bold flex-1">Help &amp; FAQ</h1>
      </header>

      <div className="px-5 mt-6">
        <h2 className="text-2xl font-extrabold">How can we help?</h2>
        <p className="text-text-muted text-sm mt-1">Common questions about using WYA.</p>
      </div>

      <div className="mt-5">
        {FAQS.map((f, i) => (
          <div key={i} className="border-b border-stroke">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <span className="font-semibold pr-4">{f.q}</span>
              <span className={`text-text-faint transition-transform ${openIdx === i ? 'rotate-45' : ''}`}>+</span>
            </button>
            {openIdx === i && (
              <div className="px-5 pb-4 text-sm text-text-muted leading-relaxed">{f.a}</div>
            )}
          </div>
        ))}
      </div>

      <div className="px-5 mt-8">
        <div className="card p-4">
          <div className="text-sm font-bold">Still stuck?</div>
          <div className="text-xs text-text-muted mt-1">Email us and we'll get back within 24 hours.</div>
          <a href="mailto:support@wya.app" className="btn primary block mt-3">Email support@wya.app</a>
        </div>
      </div>

      <div className="px-5 mt-6 text-[11px] text-text-faint text-center">
        <Link href="/" className="hover:text-white">← Back to home</Link>
      </div>
    </div>
  );
}
