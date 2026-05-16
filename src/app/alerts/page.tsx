'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { CustomerNav } from '@/components/CustomerNav';
import { PageShell } from '@/components/PageShell';
import { useAuth } from '@/lib/auth';
import { subscribeNotifications, markRead, markAllRead } from '@/lib/notifications';
import type { Notification } from '@/lib/types';
import { Spinner } from '@/components/Spinner';
import { relativeTime } from '@/lib/utils';

export default function AlertsPage() {
  return (
    <RoleGuard allow={['customer']}>
      <Alerts />
      <CustomerNav />
    </RoleGuard>
  );
}

function iconFor(t: Notification['type']) {
  if (t === 'order_status') return { bg: 'bg-success/15', fg: 'text-success', svg: <><path d="M3 8h11l3 4h4v6h-3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></> };
  if (t === 'live')         return { bg: 'bg-accent/15',  fg: 'text-accent',  svg: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></> };
  if (t === 'promo')        return { bg: 'bg-warning/15', fg: 'text-warning', svg: <path d="M20 12l-8 8-8-8 8-8z"/> };
  return { bg: 'bg-surface-2', fg: 'text-white', svg: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></> };
}

function Alerts() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeNotifications(user.uid, setItems);
  }, [user]);

  return (
    <PageShell title="Notifications"
      right={
        items && items.some(i => !i.read) && user
          ? <button className="text-xs text-text-muted" onClick={() => markAllRead(user.uid)}>Mark all read</button>
          : null
      }>
      {items === null && <div className="p-10 grid place-items-center"><Spinner /></div>}
      {items && items.length === 0 && (
        <div className="p-10 text-center">
          <div className="text-text-muted text-sm">You're all caught up.</div>
          <Link href="/map" className="btn primary mt-4 inline-flex">Discover trucks</Link>
        </div>
      )}
      <div>
        {items?.map((n) => {
          const ic = iconFor(n.type);
          return (
            <Link
              key={n.id}
              href={n.link || '#'}
              onClick={() => !n.read && markRead(n.id)}
              className={`px-5 py-3 border-b border-stroke flex items-start gap-3 ${n.read ? '' : 'bg-accent/5'}`}
            >
              <span className={`w-10 h-10 rounded-full ${ic.bg} ${ic.fg} grid place-items-center flex-shrink-0`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ic.svg}</svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold leading-snug">{n.title}</span>
                {n.body && <span className="block text-xs text-text-muted mt-0.5">{n.body}</span>}
                <span className="block text-[11px] text-text-faint mt-1">{relativeTime(n.created_at)}</span>
              </span>
              {!n.read && <span className="w-2 h-2 rounded-full bg-accent mt-2" />}
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
