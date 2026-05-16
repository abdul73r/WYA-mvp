'use client';
import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp,
  updateDoc, where, Unsubscribe, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Notification } from './types';

function ts(n: Notification): number {
  return (n.created_at as any)?.toMillis?.() ?? 0;
}

export async function addNotification(args: Omit<Notification, 'id' | 'read' | 'created_at'>) {
  await addDoc(collection(db, 'notifications'), {
    ...args,
    read: false,
    created_at: serverTimestamp(),
  });
}

export function subscribeNotifications(
  userId: string,
  cb: (items: Notification[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('user_id', '==', userId));
  return onSnapshot(
    q,
    (qs) => {
      const list = qs.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
      list.sort((a, b) => ts(b) - ts(a));
      cb(list);
    },
    (err) => { console.error('notifications error', err); cb([]); },
  );
}

export async function markRead(notifId: string) {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

/** Mark all of a user's notifications read. Filters client-side so no composite index is needed. */
export async function markAllRead(userId: string) {
  const qs = await getDocs(
    query(collection(db, 'notifications'), where('user_id', '==', userId)),
  );
  const batch = writeBatch(db);
  let n = 0;
  qs.docs.forEach((d) => {
    if ((d.data() as any).read === false) {
      batch.update(d.ref, { read: true });
      n++;
    }
  });
  if (n > 0) await batch.commit();
}
