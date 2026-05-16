'use client';
import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc, where, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Follow } from './types';

function followId(userId: string, truckId: string) {
  return `${userId}_${truckId}`;
}

export async function isFollowing(userId: string, truckId: string) {
  const snap = await getDoc(doc(db, 'follows', followId(userId, truckId)));
  return snap.exists();
}

export async function follow(userId: string, truckId: string) {
  await setDoc(doc(db, 'follows', followId(userId, truckId)), {
    user_id: userId,
    truck_id: truckId,
    created_at: serverTimestamp(),
  });
  // best-effort follower count bump
  try { await updateDoc(doc(db, 'food_trucks', truckId), { follower_count: increment(1) }); } catch {}
}

export async function unfollow(userId: string, truckId: string) {
  await deleteDoc(doc(db, 'follows', followId(userId, truckId)));
  try { await updateDoc(doc(db, 'food_trucks', truckId), { follower_count: increment(-1) }); } catch {}
}

export function subscribeFollowing(userId: string, cb: (truckIds: string[]) => void): Unsubscribe {
  const q = query(collection(db, 'follows'), where('user_id', '==', userId));
  return onSnapshot(q, (qs) => cb(qs.docs.map((d) => (d.data() as Follow).truck_id)));
}

export async function listFollowing(userId: string): Promise<string[]> {
  const qs = await getDocs(query(collection(db, 'follows'), where('user_id', '==', userId)));
  return qs.docs.map((d) => (d.data() as Follow).truck_id);
}
