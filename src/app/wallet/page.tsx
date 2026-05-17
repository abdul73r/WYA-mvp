'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import { subscribeTruck, updateTruck } from '@/lib/trucks';
import { subscribeTruckOrders } from '@/lib/orders';
import {
  computeBalances, getStripeConnectStatus, PLATFORM_FEE_RATE,
  requestPayout, startStripeOnboarding, subscribePayouts,
} from '@/lib/payouts';
import { showToast, ToastHost } from '@/components/Toast';
import type { FoodTruck, Order, Payout } from '@/lib/types';
import { dollars, relativeTime } from '@/lib/utils';

export default function WalletPage() {
  return (
    <RoleGuard allow={['owner']}>
      <Wallet />
      <OwnerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function Wallet() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile } = useAuth();
  const truckId = profile?.truck_id;
  const [truck, setTruck] = useState<FoodTruck | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busy, setBusy] = useState<'connect' | 'transfer' | 'refresh' | null>(null);

  useEffect(() => { if (!truckId) router.replace('/setup'); }, [truckId, router]);
  useEffect(() => { if (!truckId) return; return subscribeTruck(truckId, setTruck); }, [truckId]);
  useEffect(() => { if (!truckId) return; return subscribeTruckOrders(truckId, setOrders); }, [truckId]);
  useEffect(() => { if (!truckId) return; return subscribePayouts(truckId, setPayouts); }, [truckId]);

  // When the user returns from Stripe-hosted onboarding, refresh their status.
  useEffect(() => {
    if (!truck?.stripe_account_id) return;
    const stripeParam = params.get('stripe');
    if (stripeParam !== 'done' && stripeParam !== 'refresh') return;
    (async () => {
      try {
        const s = await getStripeConnectStatus(truck.stripe_account_id!);
        await updateTruck(truck.id, {
          stripe_payouts_enabled: s.payouts_enabled,
          stripe_charges_enabled: s.charges_enabled,
          stripe_details_submitted: s.details_submitted,
        } as any);
        showToast(s.payouts_enabled ? 'Stripe connected — you can transfer money now' : 'Stripe onboarding in progress');
      } catch (e: any) {
        showToast(e?.message || 'Could not check Stripe status');
      } finally {
        // strip query string so we don't refresh again on reload
        router.replace('/wallet');
      }
    })();
  }, [truck?.stripe_account_id, params.get('stripe')]);

  const balances = useMemo(() => computeBalances(orders, payouts), [orders, payouts]);
  const connected = !!truck?.stripe_account_id;
  const payoutsReady = !!truck?.stripe_payouts_enabled;

  async function connectStripe() {
    if (!truck || !user) return;
    setBusy('connect');
    try {
      const { account_id, url } = await startStripeOnboarding({
        truck_id: truck.id,
        email: profile?.email || user.email || '',
        existing_account_id: truck.stripe_account_id,
      });
      // Save the new account ID locally before redirecting
      if (account_id !== truck.stripe_account_id) {
        await updateTruck(truck.id, { stripe_account_id: account_id } as any);
      }
      window.location.href = url;
    } catch (e: any) {
      showToast(e?.message || 'Could not start Stripe onboarding');
      setBusy(null);
    }
  }

  async function refreshStatus() {
    if (!truck?.stripe_account_id) return;
    setBusy('refresh');
    try {
      const s = await getStripeConnectStatus(truck.stripe_account_id);
      await updateTruck(truck.id, {
        stripe_payouts_enabled: s.payouts_enabled,
        stripe_charges_enabled: s.charges_enabled,
        stripe_details_submitted: s.details_submitted,
      } as any);
      showToast('Status refreshed');
    } catch (e: any) {
      showToast(e?.message || 'Could not refresh status');
    } finally { setBusy(null); }
  }

  async function transferOut() {
    if (!truck) return;
    if (balances.available_cents <= 0) { showToast('Nothing available to transfer'); return; }
    const destination = truck.bank_account_last4 ? `•••• ${truck.bank_account_last4}` : 'your bank';
    if (!confirm(`Transfer ${dollars(balances.available_cents)} to ${destination}?`)) return;
    setBusy('transfer');
    try {
      await requestPayout({
        truck_id: truck.id,
        amount_cents: balances.available_cents,
        bank_last4: truck.bank_account_last4,
        stripe_account_id: truck.stripe_account_id,
      });
      showToast('Transfer started!');
    } catch (e: any) {
      showToast(e?.message || 'Transfer failed');
    } finally { setBusy(null); }
  }

  if (!truck) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 className="text-lg font-bold flex-1">Wallet</h1>
      </header>

      {/* Available balance */}
      <div className="px-5 mt-4">
        <div className="rounded-2xl p-5 border border-accent/40 bg-gradient-to-br from-accent/20 to-surface">
          <div className="text-xs uppercase tracking-widest text-text-muted font-bold">Available to transfer</div>
          <div className="text-4xl font-extrabold mt-1">{dollars(balances.available_cents)}</div>
          {!connected && (
            <button
              disabled={busy === 'connect'}
              onClick={connectStripe}
              className="btn primary block mt-4"
            >
              {busy === 'connect' ? <Spinner /> : '🏦 Connect bank with Stripe'}
            </button>
          )}
          {connected && !payoutsReady && (
            <>
              <button onClick={connectStripe} disabled={busy === 'connect'} className="btn primary block mt-4">
                {busy === 'connect' ? <Spinner /> : 'Finish Stripe onboarding'}
              </button>
              <button onClick={refreshStatus} disabled={busy === 'refresh'} className="btn block mt-2">
                {busy === 'refresh' ? <Spinner /> : 'I finished — refresh status'}
              </button>
            </>
          )}
          {connected && payoutsReady && (
            <button
              disabled={busy === 'transfer' || balances.available_cents <= 0}
              onClick={transferOut}
              className="btn primary block mt-4"
            >
              {busy === 'transfer' ? <Spinner /> : `Transfer to your bank`}
            </button>
          )}
        </div>
      </div>

      {/* Secondary stats */}
      <div className="px-5 mt-4 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-widest">Pending</div>
          <div className="font-extrabold text-base mt-0.5">{dollars(balances.pending_cents)}</div>
          <div className="text-[9px] text-text-faint mt-0.5">Active orders</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-widest">Paid out</div>
          <div className="font-extrabold text-base mt-0.5">{dollars(balances.paid_out_cents)}</div>
          <div className="text-[9px] text-text-faint mt-0.5">Lifetime</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-widest">Fee</div>
          <div className="font-extrabold text-base mt-0.5">{Math.round(PLATFORM_FEE_RATE * 100)}%</div>
          <div className="text-[9px] text-text-faint mt-0.5">WYA platform</div>
        </div>
      </div>

      {/* Stripe Connect block */}
      <h2 className="px-5 mt-6 text-xs uppercase tracking-widest text-text-muted font-bold">Stripe Connect</h2>
      <div className="px-5 mt-2">
        <div className="card p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg grid place-items-center ${payoutsReady ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 10h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {!connected ? 'Not connected'
                : payoutsReady ? 'Payouts enabled'
                : 'Onboarding in progress'}
            </div>
            <div className="text-[11px] text-text-muted truncate">
              {!connected
                ? 'Connect Stripe so customer payments land in your bank account.'
                : truck.stripe_account_id}
            </div>
          </div>
          {connected && (
            <button onClick={refreshStatus} disabled={busy === 'refresh'} className="btn sm">
              {busy === 'refresh' ? <Spinner /> : 'Refresh'}
            </button>
          )}
        </div>
        {truck.bank_account_last4 && (
          <div className="text-[11px] text-text-muted mt-2 px-1">
            Display-only bank •••• {truck.bank_account_last4} — Stripe holds the real account info.
          </div>
        )}
      </div>

      {/* Transfer history */}
      <h2 className="px-5 mt-6 text-xs uppercase tracking-widest text-text-muted font-bold">Transfer history</h2>
      {payouts.length === 0 ? (
        <div className="px-5 mt-2 text-sm text-text-muted">No transfers yet.</div>
      ) : (
        <div className="mt-2">
          {payouts.map((p) => (
            <div key={p.id} className="px-5 py-3 border-b border-stroke flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{dollars(p.amount_cents)}</div>
                <div className="text-[11px] text-text-muted">
                  {p.status === 'paid' ? 'Sent' : p.status === 'in_transit' ? 'In transit' : p.status}
                  {p.bank_last4 ? ` to •••• ${p.bank_last4}` : ''} · {relativeTime(p.created_at)}
                </div>
                {p.failure_message && (
                  <div className="text-[11px] text-accent mt-0.5">{p.failure_message}</div>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                p.status === 'paid' ? 'text-success' :
                p.status === 'failed' ? 'text-accent' :
                'text-warning'
              }`}>{p.status}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 mt-6 text-[11px] text-text-faint leading-relaxed">
        Available balance is computed from completed orders minus the {Math.round(PLATFORM_FEE_RATE * 100)}% platform fee.
        Once Stripe Connect is finished and customers pay through Stripe, the balance becomes real money in your
        Stripe account, and the Transfer button issues a real payout to your bank (typically 1–2 business days).
      </div>
    </div>
  );
}
