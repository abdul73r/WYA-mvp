'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import { getOrder } from '@/lib/orders';
import { getTruck } from '@/lib/trucks';
import { sendMessage, subscribeMessages } from '@/lib/chat';
import type { ChatMessage, FoodTruck, Order } from '@/lib/types';
import { relativeTime } from '@/lib/utils';

export default function ChatPage() {
  return (
    <RoleGuard allow={['customer', 'owner']}>
      <Chat />
    </RoleGuard>
  );
}

function Chat() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [truck, setTruck] = useState<FoodTruck | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const o = await getOrder(orderId);
      setOrder(o);
      if (o) setTruck(await getTruck(o.truck_id));
    })();
    const unsub = subscribeMessages(orderId, setMessages);
    return unsub;
  }, [orderId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  if (!order || !profile) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;

  const role = profile.role === 'owner' ? 'owner' : 'customer';
  const partnerName = role === 'owner' ? order.customer_name : order.truck_name;
  const notifyUid = role === 'owner' ? order.customer_id : (truck?.owner_id || '');

  async function send() {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      await sendMessage({
        order_id: order!.id,
        sender_id: user.uid,
        sender_role: role,
        sender_name: profile!.name,
        text,
        notify_user_id: notifyUid,
      });
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{partnerName}</div>
          <div className="text-[11px] text-text-muted">Order #{order.id.slice(0,6).toUpperCase()} · {order.status}</div>
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pt-3 pb-24 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-xs text-text-muted py-12">
            No messages yet. Say hi 👋
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.uid;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? 'bg-accent text-white rounded-br-md' : 'bg-surface border border-stroke rounded-bl-md'}`}>
                {!mine && <div className="text-[10px] text-text-muted mb-0.5">{m.sender_name}</div>}
                <div className="text-sm leading-snug whitespace-pre-wrap break-words">{m.text}</div>
                <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-text-faint'}`}>{relativeTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed left-0 right-0 bottom-0 max-w-md mx-auto bg-bg/95 backdrop-blur border-t border-stroke px-3 py-3 flex gap-2 items-end">
        <textarea
          className="input flex-1"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          style={{ minHeight: 44, maxHeight: 120, padding: '12px 16px' }}
        />
        <button className="btn primary" onClick={send} disabled={!text.trim() || sending}>
          {sending ? <Spinner /> : 'Send'}
        </button>
      </div>
    </div>
  );
}
