import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/server-stripe';

/**
 * Refunds a Stripe-paid order. Called whenever an order is cancelled
 * by either the customer or the owner.
 *
 * Body: { payment_intent_id, reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent' }
 */
export async function POST(req: NextRequest) {
  try {
    const { payment_intent_id, reason } = await req.json();
    if (!payment_intent_id) {
      return NextResponse.json({ error: 'Missing payment_intent_id' }, { status: 400 });
    }
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: payment_intent_id,
      reason: reason || 'requested_by_customer',
    });
    return NextResponse.json({
      refund_id: refund.id,
      status: refund.status,
      amount: refund.amount,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Refund failed' }, { status: 500 });
  }
}
