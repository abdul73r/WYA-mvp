import { NextRequest, NextResponse } from 'next/server';

const SUPPORT_EMAIL = 'wyatruck@gmail.com';

const SYSTEM_PROMPT = `You are the WYA support assistant. WYA is a mobile-first app for finding live food trucks and ordering pickup.

Key facts you must know:
- Customers find trucks on a live map. Trucks tap "Go Live" to broadcast their GPS.
- Two payment options at checkout: 💳 Pay with card via Stripe, or 💵 Pay cash/card at the truck.
- Every order gets a 4-digit pickup code. Customer shows it; truck owner enters it before marking the order Picked up.
- Customers can cancel only BEFORE the truck accepts the order. Stripe-paid orders auto-refund on cancel.
- WYA takes a 5% platform fee on each order. Tax and tip flow entirely to the truck.
- Truck owners connect Stripe via the Wallet → "Connect bank with Stripe" → fill out Stripe-hosted onboarding → payouts land in their bank.
- Customers can follow trucks to get notified when those trucks go live nearby.
- Reviews can only be left after picking up a completed order.
- Support email: ${SUPPORT_EMAIL}

Answer in 2-4 sentences. Be warm but concise. If the question is outside food-truck-app help (e.g. politics, jokes, code), politely redirect to the support email.`;

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }

    // If an OpenAI key is configured, use it for real answers.
    if (process.env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.4,
          max_tokens: 350,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('OpenAI error', json);
        // Fall through to local responder if OpenAI fails
        return NextResponse.json({ reply: localResponse(messages[messages.length - 1].content), fallback: true });
      }
      const reply = json.choices?.[0]?.message?.content?.trim() || localResponse(messages[messages.length - 1].content);
      return NextResponse.json({ reply, source: 'openai' });
    }

    // No OpenAI key — local keyword-matched answers from the FAQ
    return NextResponse.json({
      reply: localResponse(messages[messages.length - 1].content),
      source: 'local',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Chat failed' }, { status: 500 });
  }
}

/** Keyword-matched, fast, free answers for common support questions. */
function localResponse(text: string): string {
  const q = (text || '').toLowerCase();

  if (/\b(cancel|cancellation)\b/.test(q)) {
    return 'You can cancel before the truck accepts your order — open the order from your Orders tab and tap Cancel. If you paid by card, Stripe refunds automatically within 5–10 business days. Once the truck accepts, you have to contact them directly.';
  }
  if (/(pay).{0,20}(cash|in.person|truck)/.test(q) || /\bcash\b/.test(q)) {
    return 'Yes — at checkout, pick "Pay at the truck." No charge happens online. You pay cash or card to the truck owner when you pick up your order.';
  }
  if (/(pay).{0,20}(card|app|online|stripe)/.test(q) || /\bcard\b/.test(q)) {
    return 'Tap "Pay with card" at checkout to be sent to Stripe — you can pay with card, Apple Pay, or Google Pay. Money goes directly to the truck minus our 5% fee.';
  }
  if (/(pickup\s*code|4.?digit|4 digit|confirm.*pickup)/.test(q)) {
    return 'Every order gets a 4-digit pickup code on your order page. Show it to the truck when you pick up — they enter it before marking the order completed. It prevents anyone else from grabbing your food.';
  }
  if (/\b(refund|chargeback|money\s*back)\b/.test(q)) {
    return 'If your order is cancelled (by you or the truck), Stripe-paid orders get refunded automatically. Refunds usually take 5–10 business days to appear on your card. For other refund questions, email ' + SUPPORT_EMAIL + '.';
  }
  if (/\b(fee|commission|cut|percentage|charge)\b/.test(q)) {
    return 'WYA keeps a 5% platform fee on each order. The rest — including 100% of the tip and all taxes — goes to the truck.';
  }
  if (/(how|where).{0,30}(find|see|view).{0,10}(truck|food)/.test(q) || /\bnear me\b/.test(q)) {
    return 'Tap the Map tab in the bottom nav. Every food truck currently parked nearby and live shows up as a pin. Tap a pin to view the menu and order.';
  }
  if (/\bfollow\b/.test(q)) {
    return 'Open a truck profile and tap "+ Follow." You\'ll get a notification in the Alerts tab every time they go live so you don\'t miss them.';
  }
  if (/\b(review|rating|stars)\b/.test(q)) {
    return 'After your order is marked Picked up, the order page shows a "Rate this order" button. You can leave a 1-5 star rating plus a written review. Owners can reply to your review.';
  }
  if (/\b(owner|truck owner|vendor|food truck|register).{0,30}(sign|join|list|register)/.test(q) || /(list|register).{0,30}(truck|vendor)/.test(q)) {
    return 'On the sign-up page pick "Truck owner." You\'ll enter your truck name, cuisine, parking address, and (optional) bank info up front. After signing up, tap Go Live in your dashboard to start broadcasting.';
  }
  if (/\b(go.?live|live mode|broadcasting|location)\b/.test(q)) {
    return 'Truck owners: open the Dashboard → tap "Go live now." We pull your GPS location and broadcast it to every customer following you. While live, auto-tracking sends your position every 30s so the customer map updates as you move.';
  }
  if (/\b(payout|withdraw|bank|cash.?out)\b/.test(q)) {
    return 'Truck owners: open Wallet → connect Stripe (5-min onboarding) → once payouts are enabled, the Transfer button sends your balance to your bank. It usually arrives in 1-2 business days.';
  }
  if (/\b(stripe|payment.?setup)\b/.test(q)) {
    return 'Stripe is our payment processor. Owners connect a Stripe Express account (Stripe handles all the KYC). Customers pay via Stripe Checkout. WYA takes 5%, the rest lands in the truck\'s Stripe balance.';
  }
  if (/\b(hello|hi|hey|sup|yo)\b/.test(q.trim().split(/\s+/)[0] || '')) {
    return 'Hey! I can help with payments, orders, pickup codes, refunds, going live as a truck, or anything else WYA. What do you need?';
  }
  if (/\b(contact|support|email|help|human)\b/.test(q)) {
    return `For anything I can't answer, email ${SUPPORT_EMAIL} and someone will get back to you within 24 hours.`;
  }

  return `I'm not sure about that one — try asking about payments, orders, pickup codes, refunds, fees, or going live. For anything else, email ${SUPPORT_EMAIL} and we'll get back to you within 24 hours.`;
}
