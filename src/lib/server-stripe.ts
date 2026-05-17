import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it to your environment variables and redeploy.');
  }
  if (!_stripe) {
    // Don't pin an apiVersion — use whatever the installed Stripe SDK defaults to.
    // That way upgrading the SDK doesn't force a TypeScript literal mismatch.
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true } as any);
  }
  return _stripe;
}
