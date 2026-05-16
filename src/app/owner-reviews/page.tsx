'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import { replyToReview, subscribeReviews } from '@/lib/reviews';
import { showToast, ToastHost } from '@/components/Toast';
import type { Review } from '@/lib/types';
import { relativeTime } from '@/lib/utils';

export default function OwnerReviewsPage() {
  return (
    <RoleGuard allow={['owner']}>
      <OwnerReviews />
      <OwnerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function OwnerReviews() {
  const router = useRouter();
  const { profile } = useAuth();
  const truckId = profile?.truck_id;
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!truckId) router.replace('/setup'); }, [truckId, router]);
  useEffect(() => { if (!truckId) return; return subscribeReviews(truckId, setReviews); }, [truckId]);

  async function submitReply(id: string) {
    setBusy(true);
    try {
      await replyToReview(id, replyText);
      showToast('Reply posted');
      setReplyingId(null); setReplyText('');
    } catch (e: any) {
      showToast(e?.message || 'Failed to reply');
    } finally { setBusy(false); }
  }

  const avg = reviews && reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
    : 0;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Reviews</h1>
          {reviews && reviews.length > 0 && (
            <div className="text-[11px] text-text-muted">⭐ {avg.toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
          )}
        </div>
      </header>

      {reviews === null && <div className="p-10 grid place-items-center"><Spinner /></div>}
      {reviews && reviews.length === 0 && (
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl mx-auto mb-3">⭐</div>
          <div className="font-bold">No reviews yet</div>
          <div className="text-text-muted text-sm mt-1">Once customers complete pickup orders, they can leave a rating.</div>
        </div>
      )}

      <div className="px-5 mt-3 flex flex-col gap-3">
        {reviews?.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-bold text-sm truncate">{r.customer_name}</div>
              <div className="text-sm">{'⭐'.repeat(r.rating)}</div>
            </div>
            <div className="text-[11px] text-text-muted">{relativeTime(r.created_at)}</div>
            {r.body && <p className="text-sm mt-2 leading-snug">{r.body}</p>}

            {r.owner_reply ? (
              <div className="mt-3 rounded-lg bg-surface-2 border border-stroke px-3 py-2">
                <div className="text-[11px] text-accent font-bold uppercase tracking-widest mb-1">Your reply</div>
                <div className="text-sm leading-snug">{r.owner_reply}</div>
              </div>
            ) : replyingId === r.id ? (
              <div className="mt-3">
                <textarea
                  className="input"
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Thank them, address the feedback, etc."
                />
                <div className="flex gap-2 mt-2">
                  <button className="btn primary sm" disabled={busy || !replyText.trim()} onClick={() => submitReply(r.id)}>
                    {busy ? <Spinner /> : 'Post reply'}
                  </button>
                  <button className="btn sm" onClick={() => { setReplyingId(null); setReplyText(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn sm mt-3" onClick={() => { setReplyingId(r.id); setReplyText(''); }}>
                Reply
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
