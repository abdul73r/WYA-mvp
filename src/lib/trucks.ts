'use client';
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where, GeoPoint, writeBatch, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { FoodTruck } from './types';

const TRUCKS = 'food_trucks';
const LIVE_LOCS = 'live_locations';
const USERS = 'users';

export async function createTruck(ownerId: string, data: {
  name: string; description: string; cuisine: FoodTruck['cuisine']; logo_url?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, TRUCKS), {
    owner_id: ownerId,
    name: data.name,
    description: data.description,
    cuisine: data.cuisine,
    logo_url: data.logo_url || '',
    cover_url: '',
    is_live: false,
    is_open: true,
    rating: 0,
    rating_count: 0,
    follower_count: 0,
    created_at: serverTimestamp(),
  });
  await updateDoc(doc(db, USERS, ownerId), { truck_id: ref.id });
  return ref.id;
}

export async function getTruck(truckId: string): Promise<FoodTruck | null> {
  const snap = await getDoc(doc(db, TRUCKS, truckId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as FoodTruck) : null;
}

export function subscribeTruck(
  truckId: string,
  cb: (truck: FoodTruck | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, TRUCKS, truckId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as FoodTruck) : null);
  });
}

export async function updateTruck(truckId: string, patch: Partial<FoodTruck>) {
  await updateDoc(doc(db, TRUCKS, truckId), patch as any);
}

export function subscribeLiveTrucks(cb: (trucks: FoodTruck[]) => void): Unsubscribe {
  const q = query(collection(db, TRUCKS), where('is_live', '==', true));
  return onSnapshot(q, (qs) => {
    cb(qs.docs.map((d) => ({ id: d.id, ...d.data() } as FoodTruck)));
  });
}

export async function getAllTrucks(): Promise<FoodTruck[]> {
  const qs = await getDocs(collection(db, TRUCKS));
  return qs.docs.map((d) => ({ id: d.id, ...d.data() } as FoodTruck));
}

// ---------- Live / location ----------

/**
 * Notifies every follower that this truck just went live.
 * Best-effort — failures are swallowed so they don't block the go-live action.
 */
async function notifyFollowersOfLive(truckId: string, truckName: string) {
  try {
    const qs = await getDocs(query(collection(db, 'follows'), where('truck_id', '==', truckId)));
    if (qs.empty) return;
    const batch = writeBatch(db);
    qs.docs.forEach((d) => {
      const data = d.data() as any;
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        user_id: data.user_id,
        type: 'live',
        title: `${truckName} just went live`,
        body: 'Open the map to see where they’re parked.',
        link: `/truck/${truckId}`,
        read: false,
        created_at: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch { /* best-effort */ }
}

export async function goLive(truckId: string, coords: { lat: number; lng: number }) {
  const gp = new GeoPoint(coords.lat, coords.lng);
  // read current state to detect the live transition + truck name for notifications
  const before = await getDoc(doc(db, TRUCKS, truckId));
  const wasLive = before.exists() && (before.data() as any).is_live === true;
  const truckName = before.exists() ? (before.data() as any).name : 'A truck';

  await updateDoc(doc(db, TRUCKS, truckId), {
    is_live: true,
    location: gp,
    location_updated_at: serverTimestamp(),
  });
  await setDoc(doc(db, LIVE_LOCS, truckId), {
    truck_id: truckId,
    location: gp,
    updated_at: serverTimestamp(),
  });

  // Only notify on the offline → live transition (so re-broadcasts don't spam)
  if (!wasLive) await notifyFollowersOfLive(truckId, truckName);
}

export async function goOffline(truckId: string) {
  await updateDoc(doc(db, TRUCKS, truckId), { is_live: false });
}

export async function updateLocation(truckId: string, coords: { lat: number; lng: number }) {
  const gp = new GeoPoint(coords.lat, coords.lng);
  await updateDoc(doc(db, TRUCKS, truckId), {
    location: gp,
    location_updated_at: serverTimestamp(),
  });
  await setDoc(doc(db, LIVE_LOCS, truckId), {
    truck_id: truckId,
    location: gp,
    updated_at: serverTimestamp(),
  });
}

export async function setOpenStatus(truckId: string, open: boolean) {
  await updateDoc(doc(db, TRUCKS, truckId), { is_open: open });
}
