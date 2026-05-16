'use client';
import {
  addDoc, collection, doc, onSnapshot, query, runTransaction,
  serverTimestamp, updateDoc, where, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Review } from './types';

function ts(r: Review): number {
  return (r.created_at as any)?.toMillis?.() ?? 0;
}

export async function leaveReview(args: {
  truck_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  rating: number;
  body?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'reviews'), {
    truck_id: args.truck_id,
    order_id: args.order_id,
    customer_id: args.customer_id,
    customer_name: args.customer_name,
    rating: Math.max(1, Math.min(5, Math.round(args.rating))),
    body: (args.body || '').trim(),
    created_at: serverTimestamp(),
  });

  await updateDoc(doc(db, 'orders', args.order_id), { rated: true });

  const truckRef = doc(db, 'food_trucks', args.truck_id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(truckRef);
    if (!snap.exists()) return;
    const t = snap.data() as any;
    const prevRating = t.rating || 0;
    const prevCount = t.rating_count || 0;
    const newCount = prevCount + 1;
    const newRating = (prevRating * prevCount + args.rating) / newCount;
    tx.update(truckRef, {
      rating: Math.round(newRating * 10) / 10,
      rating_count: newCount,
    });
  });

  return ref.id;
}

export function subscribeReviews(truckId: string, cb: (rs: Review[]) => void): Unsubscribe {
  const q = query(collection(db, 'reviews'), where('truck_id', '==', truckId));
  return onSnapshot(
    q,
    (qs) => {
      const list = qs.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
      list.sort((a, b) => ts(b) - ts(a));
      cb(list);
    },
    (err) => { console.error('reviews error', err); cb([]); },
  );
}

export async function replyToReview(reviewId: string, reply: string) {
  await updateDoc(doc(db, 'reviews', reviewId), {
    owner_reply: reply.trim(),
    owner_reply_at: serverTimestamp(),
  });
}
