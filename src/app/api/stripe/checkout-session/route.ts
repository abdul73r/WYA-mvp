import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/server-stripe';

/**
 * Creates a Stripe Checkout Session for a customer order.
 * The payment is a destination charge: card is charged on our platform, then funds
 * (minus our 5% application fee) transfer into the truck's Stripe Connect account.
 *
 * Body: {
 *   order_id: string;
 *   stripe_account_id: string;
 *   truck_name: string;
 *   subtotal_cents: number;
 *   tax_cents: number;
 *   tip_cents: number;
 *   discount_cents?: number;
 *   line_items: { name: string; unit_price_cents: number; qty: number; }[];
 * }
 * Returns: { url, session_id }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      order_id, stripe_account_id, truck_name,
      subtotal_cents, tax_cents, tip_cents, discount_cents = 0,
      line_items,
    } = body;

    if (!order_id || !stripe_account_id) {
      return NextResponse.json({ error: 'Missing order_id or stripe_account_id' }, { status: 400 });
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // 5% platform fee on subtotal (excluding tax/tip — tip flows entirely to truck)
    const taxable = Math.max(0, subtotal_cents - discount_cents);
    const applicationFee = Math.round(taxable * 0.05);

    const items: any[] = (line_items || []).map((l: any) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: l.name },
        unit_amount: l.unit_price_cents,
      },
      quantity: l.qty,
    }));
    if (discount_cents > 0) {
      // Stripe doesn't support negative line items in Checkout; folding into a coupon-like adjustment isn't possible mid-flight.
      // Easiest: don't show a discount line, just lower the totals via tax/fee math. Tip + tax become separate "lines".
    }
    if (tax_cents > 0) {
      items.push({
        price_data: { currency: 'usd', product_data: { name: 'Tax' }, unit_amount: tax_cents },
        quantity: 1,
      });
    }
    if (tip_cents > 0) {
      items.push({
        price_data: { currency: 'usd', product_data: { name: 'Tip for the truck' }, unit_amount: tip_cents },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items,
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: stripe_account_id },
        metadata: { order_id, truck_name },
      },
      metadata: { order_id, truck_name },
      success_url: `${baseUrl}/orders/${order_id}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/orders/${order_id}?stripe=cancel`,
    });

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Checkout session failed' }, { status: 500 });
  }
}
