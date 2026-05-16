import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/server-stripe';

/**
 * Creates a Stripe payout from a connected account's available balance to the
 * bank account that was attached during Stripe Connect onboarding.
 *
 * Body: { stripe_account_id, amount_cents }
 * Returns: { payout_id, status, arrival_date }
 *
 * The connected account must be `payouts_enabled` and have available balance.
 */
export async function POST(req: NextRequest) {
  try {
    const { stripe_account_id, amount_cents } = await req.json();
    if (!stripe_account_id) return NextResponse.json({ error: 'Missing stripe_account_id' }, { status: 400 });
    if (!amount_cents || amount_cents <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    const stripe = getStripe();

    const payout = await stripe.payouts.create(
      {
        amount: amount_cents,
        currency: 'usd',
        statement_descriptor: 'WYA',
        metadata: { source: 'wya-wallet' },
      },
      { stripeAccount: stripe_account_id },
    );

    return NextResponse.json({
      payout_id: payout.id,
      status: payout.status,
      arrival_date: payout.arrival_date,
      destination: payout.destination,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Payout failed' }, { status: 500 });
  }
}
