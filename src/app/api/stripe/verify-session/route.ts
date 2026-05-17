import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/server-stripe';

/**
 * Verifies a Stripe Checkout Session is fully paid before the client trusts the redirect.
 * Body: { session_id }
 * Returns: { paid: boolean, order_id, payment_intent_id, amount_total }
 */
export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json();
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent'],
    });
    const paid = session.payment_status === 'paid';
    return NextResponse.json({
      paid,
      order_id: (session.metadata as any)?.order_id || null,
      payment_intent_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null,
      amount_total: session.amount_total,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Verification failed' }, { status: 500 });
  }
}
