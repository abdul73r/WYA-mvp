'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import { getOrder } from '@/lib/orders';
import { leaveReview } from '@/lib/reviews';
import type { Order } from '@/lib/types';
import { showToast, ToastHost } from '@/components/Toast';

export default function ReviewPage() {
  return (
    <RoleGuard allow={['customer']}>
      <Review />
      <ToastHost />
    </RoleGuard>
  );
}

function Review() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    getOrder(orderId).then(setOrder);
  }, [orderId]);

  async function submit() {
    if (!user || !profile || !order) return;
    setErr(null); setBusy(true);
    try {
      if (order.rated) throw new Error('You already rated this order.');
      await leaveReview({
        truck_id: order.truck_id,
        order_id: order.id,
        customer_id: user.uid,
        customer_name: profile.name,
        rating, body,
      });
      showToast('Thanks for the review!');
      router.replace(`/orders/${order.id}`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to submit');
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-10 page-enter">
      <header className="px-5 py-3 border-b border-stroke flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 className="text-lg font-bold flex-1">Rate your order</h1>
      </header>

      <div className="px-5 mt-6">
        <div className="text-xs uppercase tracking-widest text-text-muted font-bold">How was it?</div>
        <div className="font-extrabold text-2xl mt-1">{order.truck_name}</div>
        <div className="text-xs text-text-muted mt-1">#{order.id.slice(0,6).toUpperCase()}</div>

        <div className="flex justify-center gap-2 mt-6">
          {[1,2,3,4,5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className="text-4xl"
              aria-label={`${n} stars`}
            >
              {n <= rating ? '⭐' : '☆'}
            </button>
          ))}
        </div>
        <div className="text-center text-sm text-text-muted mt-2">
          {rating === 5 ? 'Amazing!' : rating === 4 ? 'Pretty good' : rating === 3 ? 'It was okay' : rating === 2 ? 'Could be better' : 'Not great'}
        </div>

        <div className="mt-6">
          <label className="field-label">Tell others what you thought (optional)</label>
          <textarea
            className="input"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Best birria in Brooklyn…"
          />
        </div>

        {err && <div className="text-sm text-accent mt-3">{err}</div>}

        <button className="btn primary block mt-6" disabled={busy || order.rated} onClick={submit}>
          {busy ? <Spinner /> : (order.rated ? 'Already rated' : 'Submit review')}
        </button>
        <button className="btn block mt-2" onClick={() => router.back()}>Maybe later</button>
      </div>
    </div>
  );
}
