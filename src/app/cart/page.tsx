'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { clearCart, setLineQty, useCart, cartTotal } from '@/lib/cart';
import { placeOrder } from '@/lib/orders';
import { applyPromo } from '@/lib/promos';
import { getTruck } from '@/lib/trucks';
import { useAuth } from '@/lib/auth';
import { dollars } from '@/lib/utils';
import { Spinner } from '@/components/Spinner';
import { showToast, ToastHost } from '@/components/Toast';
import type { FoodTruck } from '@/lib/types';

const TIP_OPTIONS = [
  { label: 'No tip', cents: 0 },
  { label: '15%',    pct: 15 },
  { label: '20%',    pct: 20 },
  { label: '25%',    pct: 25 },
];

export default function CartPage() {
  return (
    <RoleGuard allow={['customer']}>
      <Cart />
      <CustomerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function Cart() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [tipIdx, setTipIdx] = useState(1);
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [truck, setTruck] = useState<FoodTruck | null>(null);

  // Fetch the truck so we know whether to do Stripe Checkout or simulate
  useEffect(() => {
    if (!cart) return;
    getTruck(cart.truck_id).then(setTruck).catch(() => {});
  }, [cart?.truck_id]);

  const subtotal = cartTotal(cart);
  const promo = useMemo(() => applyPromo(promoCode, subtotal), [promoCode, subtotal]);
  const discount = promo?.discount_cents || 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * 0.0825);
  const tipOpt = TIP_OPTIONS[tipIdx];
  const tip = tipOpt.cents !== undefined ? tipOpt.cents : Math.round(subtotal * (tipOpt.pct! / 100));
  const total = taxable + tax + tip;
  const prepMinutes = useMemo(
    () => Math.max(0, ...(cart?.lines.map((l) => l.prep_minutes || 0) || [0])),
    [cart],
  );

  const stripeEnabled = !!truck?.stripe_charges_enabled;

  function tryApplyPromo() {
    setPromoErr(null);
    const res = applyPromo(promoInput, subtotal);
    if (!res) { setPromoErr('That code isn’t valid for this order.'); setPromoCode(''); return; }
    setPromoCode(res.code);
    showToast(`${res.code} applied — ${res.label}`);
  }

  async function onPlace() {
    if (!cart || !user || !profile) return;
    setBusy(true);
    try {
      // 1) Always create the order first so we have a stable ID
      const { order_id } = await placeOrder({
        customer_id: user.uid,
        customer_name: profile.name,
        truck_id: cart.truck_id,
        truck_name: cart.truck_name,
        lines: cart.lines,
        notes: notes || undefined,
        tip_cents: tip,
        promo_code: promo?.code,
        discount_cents: discount,
        prep_minutes: prepMinutes,
        payment_status: stripeEnabled ? 'pending' : 'paid',
      });

      // 2) If the truck has Stripe Connect, redirect to Stripe Checkout
      if (stripeEnabled && truck?.stripe_account_id) {
        const res = await fetch('/api/stripe/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id,
            stripe_account_id: truck.stripe_account_id,
            truck_name: cart.truck_name,
            subtotal_cents: subtotal,
            tax_cents: tax,
            tip_cents: tip,
            discount_cents: discount,
            line_items: cart.lines.map((l) => ({
              name: l.name,
              unit_price_cents: l.unit_price_cents,
              qty: l.qty,
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Checkout failed');
        clearCart();
        window.location.href = json.url; // off-site to Stripe Checkout
        return;
      }

      // 3) Otherwise (truck not Stripe-connected): simulated flow
      clearCart();
      showToast('Order placed (simulated payment)');
      router.replace(`/orders/${order_id}`);
    } catch (e: any) {
      showToast(e?.message || 'Failed to place order');
    } finally {
      setBusy(false);
    }
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
        <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <h1 className="text-lg font-bold">Your cart</h1>
        </header>
        <div className="p-10 grid place-items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl">🛒</div>
          <div className="font-bold mt-2">Your cart is empty</div>
          <div className="text-text-muted text-sm">Add items from any live truck to get started.</div>
          <Link href="/map" className="btn primary mt-3">Find a truck</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-32 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Your cart</h1>
          <div className="text-[11px] text-text-muted">{cart.truck_name} · Pickup</div>
        </div>
        <button onClick={() => { clearCart(); showToast('Cart cleared'); }} className="text-xs text-text-muted">Clear</button>
      </header>

      <div className="px-5 mt-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/15 grid place-items-center text-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h13l3 4h2v6h-3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Pickup at the truck</div>
            <div className="text-[11px] text-text-muted">
              {prepMinutes > 0 ? `Ready in ~${prepMinutes} min after the truck accepts` : 'ETA shown once the truck accepts'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2">
        {cart.lines.map((l) => (
          <div key={l.menu_item_id} className="px-5 py-3 border-b border-stroke flex gap-3 items-center">
            <div className="w-14 h-14 rounded-lg bg-surface-2 overflow-hidden flex-shrink-0">
              {l.photo_url && <img src={l.photo_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{l.name}</div>
              <div className="text-xs text-text-muted mt-0.5">{dollars(l.unit_price_cents)} each</div>
              {l.notes && <div className="text-[11px] text-warning mt-1 line-clamp-2">⚠ {l.notes}</div>}
              <div className="inline-flex items-center gap-1 bg-surface-2 rounded-full mt-2 p-0.5">
                <button className="w-7 h-7 rounded-full hover:bg-stroke font-bold" onClick={() => setLineQty(l.menu_item_id, l.qty - 1)}>−</button>
                <span className="px-2 text-sm font-semibold min-w-[16px] text-center">{l.qty}</span>
                <button className="w-7 h-7 rounded-full hover:bg-stroke font-bold" onClick={() => setLineQty(l.menu_item_id, l.qty + 1)}>+</button>
              </div>
            </div>
            <div className="text-sm font-bold">{dollars(l.unit_price_cents * l.qty)}</div>
          </div>
        ))}
      </div>

      <div className="px-5 mt-5">
        <label className="field-label">Notes for the truck (optional)</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. No onions, extra hot sauce" />
      </div>

      <div className="px-5 mt-5">
        <label className="field-label">Promo code</label>
        {promoCode ? (
          <div className="card flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-full bg-success/15 text-success grid place-items-center">✓</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">{promoCode}</div>
              <div className="text-[11px] text-text-muted truncate">{promo?.label} · −{dollars(discount)}</div>
            </div>
            <button className="text-xs text-text-muted" onClick={() => { setPromoCode(''); setPromoInput(''); }}>Remove</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input className="input flex-1" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="Try WYA10, WYA5, FIRST" />
            <button className="btn" onClick={tryApplyPromo}>Apply</button>
          </div>
        )}
        {promoErr && <div className="text-xs text-accent mt-1">{promoErr}</div>}
      </div>

      <div className="px-5 mt-5">
        <div className="field-label">Tip the truck</div>
        <div className="grid grid-cols-4 gap-2">
          {TIP_OPTIONS.map((t, i) => (
            <button key={i} onClick={() => setTipIdx(i)}
              className={`h-10 rounded-lg text-sm font-semibold border transition-colors ${tipIdx === i ? 'border-accent bg-accent/10 text-white' : 'border-stroke bg-surface text-text-muted'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6 text-sm space-y-1.5">
        <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span>{dollars(subtotal)}</span></div>
        {discount > 0 && (
          <div className="flex justify-between text-success"><span>Promo {promoCode}</span><span>−{dollars(discount)}</span></div>
        )}
        <div className="flex justify-between"><span className="text-text-muted">Estimated tax</span><span>{dollars(tax)}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Tip</span><span>{dollars(tip)}</span></div>
        <div className="flex justify-between font-bold text-base pt-2 border-t border-stroke mt-2">
          <span>Total</span><span>{dollars(total)}</span>
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-[72px] z-30 max-w-md mx-auto px-4 pb-2 pointer-events-none">
        <button
          className="btn primary block pointer-events-auto shadow-xl shadow-accent/30 flex justify-between"
          onClick={onPlace}
          disabled={busy}
        >
          <span>{busy ? <Spinner /> : (stripeEnabled ? 'Pay with Stripe' : 'Place pickup order')}</span>
          <span className="font-bold">{dollars(total)}</span>
        </button>
        <p className="text-[10px] text-text-muted text-center mt-2 pointer-events-auto">
          {stripeEnabled
            ? 'Secure card payment by Stripe · funds go to the truck minus our 5% fee'
            : 'Truck hasn’t connected Stripe yet — this checkout is simulated'}
        </p>
      </div>
    </div>
  );
}
