export interface PromoResult {
  code: string;
  label: string;
  discount_cents: number;
}

/**
 * Built-in promo codes for the MVP. Easy to migrate to Firestore later.
 *  - WYA10:  10% off subtotal (max $5)
 *  - WYA5:   $5 off (min subtotal $15)
 *  - FIRST:  $3 off your first order
 */
export function applyPromo(code: string, subtotal_cents: number): PromoResult | null {
  const c = (code || '').trim().toUpperCase();
  if (!c) return null;
  switch (c) {
    case 'WYA10': {
      const off = Math.min(Math.round(subtotal_cents * 0.10), 500);
      if (subtotal_cents < 500) return null;
      return { code: c, label: '10% off (max $5)', discount_cents: off };
    }
    case 'WYA5': {
      if (subtotal_cents < 1500) return null;
      return { code: c, label: '$5 off ($15 min)', discount_cents: 500 };
    }
    case 'FIRST': {
      if (subtotal_cents < 500) return null;
      return { code: c, label: '$3 off first order', discount_cents: 300 };
    }
    default:
      return null;
  }
}
