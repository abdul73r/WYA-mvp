'use client';
import {
  addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ChatMessage } from './types';
import { addNotification } from './notifications';

export async function sendMessage(args: {
  order_id: string;
  sender_id: string;
  sender_role: 'customer' | 'owner';
  sender_name: string;
  text: string;
  notify_user_id?: string;
  truck_name?: string;
}) {
  const trimmed = args.text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'orders', args.order_id, 'messages'), {
    order_id: args.order_id,
    sender_id: args.sender_id,
    sender_role: args.sender_role,
    sender_name: args.sender_name,
    text: trimmed,
    created_at: serverTimestamp(),
  });
  if (args.notify_user_id) {
    await addNotification({
      user_id: args.notify_user_id,
      type: 'message',
      title: `${args.sender_name}: ${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}`,
      link: `/chat/${args.order_id}`,
    });
  }
}

export function subscribeMessages(orderId: string, cb: (ms: ChatMessage[]) => void): Unsubscribe {
  const q = query(collection(db, 'orders', orderId, 'messages'), orderBy('created_at', 'asc'));
  return onSnapshot(q, (qs) =>
    cb(qs.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage))),
  );
}
