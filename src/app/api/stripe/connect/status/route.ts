import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/server-stripe';

/**
 * Returns the live status of a Stripe Connect account.
 * Body: { stripe_account_id }
 * Returns: { payouts_enabled, charges_enabled, details_submitted, balance_available_cents }
 */
export async function POST(req: NextRequest) {
  try {
    const { stripe_account_id } = await req.json();
    if (!stripe_account_id) return NextResponse.json({ error: 'Missing stripe_account_id' }, { status: 400 });

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(stripe_account_id);

    // Fetch balance on the connected account (only available if charges_enabled)
    let availableCents = 0;
    let pendingCents = 0;
    try {
      const balance = await stripe.balance.retrieve({ stripeAccount: stripe_account_id });
      availableCents = balance.available.reduce((s, b) => s + b.amount, 0);
      pendingCents = balance.pending.reduce((s, b) => s + b.amount, 0);
    } catch {/* account might not yet support balance reads */}

    return NextResponse.json({
      payouts_enabled: account.payouts_enabled,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      balance_available_cents: availableCents,
      balance_pending_cents: pendingCents,
      requirements_due: account.requirements?.currently_due || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Status check failed' }, { status: 500 });
  }
}
