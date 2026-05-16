'use client';
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, where, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Order, Payout } from './types';

export const PLATFORM_FEE_RATE = 0.05;

export function netForOrder(o: Order): number {
  return Math.max(0, Math.round(o.total_cents * (1 - PLATFORM_FEE_RATE)));
}

export interface Balances {
  available_cents: number;
  pending_cents: number;
  paid_out_cents: number;
  in_flight_cents: number;
}

export function computeBalances(orders: Order[], payouts: Payout[]): Balances {
  let earned = 0;
  let pending = 0;
  for (const o of orders) {
    if (o.status === 'completed') earned += netForOrder(o);
    else if (o.status !== 'cancelled') pending += netForOrder(o);
  }
  let paid = 0, inFlight = 0;
  for (const p of payouts) {
    if (p.status === 'paid') paid += p.amount_cents;
    else if (p.status === 'pending' || p.status === 'in_transit') inFlight += p.amount_cents;
  }
  return {
    available_cents: Math.max(0, earned - paid - inFlight),
    pending_cents: pending,
    paid_out_cents: paid,
    in_flight_cents: inFlight,
  };
}

function ts(p: Payout): number {
  return (p.created_at as any)?.toMillis?.() ?? 0;
}

export function subscribePayouts(truckId: string, cb: (ps: Payout[]) => void): Unsubscribe {
  const q = query(collection(db, 'payouts'), where('truck_id', '==', truckId));
  return onSnapshot(
    q,
    (qs) => {
      const list = qs.docs.map((d) => ({ id: d.id, ...d.data() } as Payout));
      list.sort((a, b) => ts(b) - ts(a));
      cb(list);
    },
    (err) => { console.error('payouts error', err); cb([]); },
  );
}

export async function requestPayout(args: {
  truck_id: string;
  amount_cents: number;
  bank_last4?: string;
  stripe_account_id?: string;
}): Promise<{ id: string; status: string }> {
  if (args.stripe_account_id) {
    const res = await fetch('/api/stripe/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stripe_account_id: args.stripe_account_id,
        amount_cents: args.amount_cents,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Stripe payout failed');

    const ref = await addDoc(collection(db, 'payouts'), {
      truck_id: args.truck_id,
      amount_cents: args.amount_cents,
      bank_last4: args.bank_last4 || '',
      stripe_payout_id: json.payout_id,
      stripe_account_id: args.stripe_account_id,
      status: json.status === 'paid' ? 'paid' : 'in_transit',
      created_at: serverTimestamp(),
      ...(json.status === 'paid' ? { paid_at: serverTimestamp() } : {}),
    });
    return { id: ref.id, status: json.status };
  }

  const ref = await addDoc(collection(db, 'payouts'), {
    truck_id: args.truck_id,
    amount_cents: args.amount_cents,
    bank_last4: args.bank_last4 || '',
    status: 'paid',
    created_at: serverTimestamp(),
    paid_at: serverTimestamp(),
  });
  return { id: ref.id, status: 'paid' };
}

export async function startStripeOnboarding(args: {
  truck_id: string;
  email: string;
  existing_account_id?: string;
}): Promise<{ account_id: string; url: string }> {
  const res = await fetch('/api/stripe/connect/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      truck_id: args.truck_id,
      email: args.email,
      stripe_account_id: args.existing_account_id,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to start onboarding');
  return json;
}

export async function getStripeConnectStatus(stripe_account_id: string): Promise<{
  payouts_enabled: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  balance_available_cents: number;
  balance_pending_cents: number;
  requirements_due: string[];
}> {
  const res = await fetch('/api/stripe/connect/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stripe_account_id }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch status');
  return json;
}
