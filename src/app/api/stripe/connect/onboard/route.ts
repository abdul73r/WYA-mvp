import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/server-stripe';

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
    const { truck_id, email, stripe_account_id } = await req.json();
    if (!truck_id) return NextResponse.json({ error: 'Missing truck_id' }, { status: 400 });

    const stripe = getStripe();
    const baseUrl = originOf(req);

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
