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

type PayMethod = 'stripe' | 'cash_on_pickup';

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
  const [payMethod, setPayMethod] = useState<PayMethod>('cash_on_pickup');
  const [scheduleMode, setScheduleMode] = useState<'asap' | 'later'>('asap');
  const [scheduleTime, setScheduleTime] = useState(''); // "HH:MM" 24h

  useEffect(() => {
    if (!cart) return;
    getTruck(cart.truck_id).then((t) => {
      setTruck(t);
      // If the truck takes Stripe, default to in-app payment for convenience
      if (t?.stripe_charges_enabled) setPayMethod('stripe');
    }).catch(() => {});
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
      const isStripe = payMethod === 'stripe' && stripeEnabled && truck?.stripe_account_id;

      // Build scheduled pickup datetime if "Later" was picked
      let scheduledFor: Date | null = null;
      if (scheduleMode === 'later' && scheduleTime) {
        const [h, m] = scheduleTime.split(':').map(Number);
        const dt = new Date();
        dt.setHours(h, m, 0, 0);
        if (dt.getTime() < Date.now() + 10 * 60 * 1000) {
          throw new Error('Pickup time must be at least 10 minutes from now.');
        }
        scheduledFor = dt;
      }

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
        payment_method: isStripe ? 'stripe' : 'cash_on_pickup',
        payment_status: isStripe ? 'pending' : 'paid',
        scheduled_for: scheduledFor,
      });

      if (isStripe) {
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
        window.location.href = json.url;
        return;
      }

      // Cash on pickup — no payment processing, just commit and notify the truck
      clearCart();
      showToast('Order sent — pay when you pick up');
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
    <div className="min-h-screen max-w-md mx-auto pb-44 page-enter">
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

      {/* Pickup info */}
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

      {/* Cart items */}
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

      {/* Schedule pickup */}
      <div className="px-5 mt-5">
        <div className="field-label">Pickup time</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setScheduleMode('asap')}
            className={`h-12 rounded-lg text-sm font-semibold border ${scheduleMode === 'asap' ? 'border-accent bg-accent/10 text-white' : 'border-stroke bg-surface text-text-muted'}`}
          >⚡ ASAP</button>
          <button
            type="button"
            onClick={() => setScheduleMode('later')}
            className={`h-12 rounded-lg text-sm font-semibold border ${scheduleMode === 'later' ? 'border-accent bg-accent/10 text-white' : 'border-stroke bg-surface text-text-muted'}`}
          >📅 Schedule</button>
        </div>
        {scheduleMode === 'later' && (
          <div className="mt-2">
            <input
              type="time"
              className="input"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
            <div className="text-[11px] text-text-muted mt-1">Pickup must be at least 10 min from now. Today only.</div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="px-5 mt-5">
        <label className="field-label">Notes for the truck (optional)</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. No onions, extra hot sauce" />
      </div>

      {/* Promo */}
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

      {/* Tip */}
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

      {/* Payment method picker */}
      <div className="px-5 mt-6">
        <div className="field-label">How do you want to pay?</div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => stripeEnabled && setPayMethod('stripe')}
            disabled={!stripeEnabled}
            className={`text-left p-4 rounded-xl border flex items-center gap-3 ${payMethod === 'stripe' ? 'border-accent bg-accent/10' : 'border-stroke bg-surface'} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="w-10 h-10 rounded-lg bg-surface-2 grid place-items-center text-xl">💳</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Pay now with card</div>
              <div className="text-[11px] text-text-muted">
                {stripeEnabled
                  ? 'Secure card payment via Stripe — no need to handle cash'
                  : 'Not available — this truck doesn’t accept in-app payments yet'}
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 grid place-items-center ${payMethod === 'stripe' ? 'border-accent' : 'border-stroke-2'}`}>
              {payMethod === 'stripe' && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPayMethod('cash_on_pickup')}
            className={`text-left p-4 rounded-xl border flex items-center gap-3 ${payMethod === 'cash_on_pickup' ? 'border-accent bg-accent/10' : 'border-stroke bg-surface'}`}
          >
            <div className="w-10 h-10 rounded-lg bg-surface-2 grid place-items-center text-xl">💵</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Pay at the truck</div>
              <div className="text-[11px] text-text-muted">Cash or card in person when you pick up your order</div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 grid place-items-center ${payMethod === 'cash_on_pickup' ? 'border-accent' : 'border-stroke-2'}`}>
              {payMethod === 'cash_on_pickup' && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </div>
          </button>
        </div>
      </div>

      {/* Totals */}
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

      {/* Sticky CTA */}
      <div className="fixed left-0 right-0 bottom-[72px] z-30 max-w-md mx-auto px-4 pb-2 pointer-events-none">
        <button
          className="btn primary block pointer-events-auto shadow-xl shadow-accent/30 flex justify-between"
          onClick={onPlace}
          disabled={busy}
        >
          <span>
            {busy ? <Spinner /> : payMethod === 'stripe' ? 'Pay with card' : 'Place order — pay at truck'}
          </span>
          <span className="font-bold">{dollars(total)}</span>
        </button>
        <p className="text-[10px] text-text-muted text-center mt-2 pointer-events-auto">
          {payMethod === 'stripe'
            ? 'You’ll be sent to Stripe to enter your card'
            : 'No charge now · pay the truck in person at pickup'}
        </p>
      </div>
    </div>
  );
}
