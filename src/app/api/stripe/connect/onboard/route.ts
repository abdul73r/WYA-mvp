import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/server-stripe';

/**
 * Creates a Stripe Connect Express account if the truck doesn't have one yet,
 * then returns an onboarding URL the owner can be redirected to.
 *
 * Body: { truck_id, email, stripe_account_id?: existing one }
 * Returns: { account_id, url }
 *
 * NOTE: The client saves account_id back to Firestore. We trust the client to pass
 * the right truck_id / stripe_account_id since the Firebase Auth session is on the
 * client. For hardening, verify a Firebase ID token here in production.
 */
export async function POST(req: NextRequest) {
  try {
    const { truck_id, email, stripe_account_id } = await req.json();
    if (!truck_id) return NextResponse.json({ error: 'Missing truck_id' }, { status: 400 });

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    let accountId = stripe_account_id as string | undefined;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: { truck_id },
      });
      accountId = account.id;
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/wallet?stripe=refresh`,
      return_url:  `${baseUrl}/wallet?stripe=done`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ account_id: accountId, url: link.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Onboarding failed' }, { status: 500 });
  }
}
