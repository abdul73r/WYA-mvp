import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/server-stripe';

/**
 * Returns the public origin the request came from (https://wyatruck.com,
 * https://wya-mvp-1qkt.vercel.app, http://localhost:3000, etc.).
 * Works whether the user is on the production URL, a preview deployment,
 * or local dev — without needing NEXT_PUBLIC_BASE_URL to be set right.
 */
function originOf(req: NextRequest): string {
  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) return `${proto}://${host}`;
  return (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

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
    const baseUrl = originOf(req);

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
