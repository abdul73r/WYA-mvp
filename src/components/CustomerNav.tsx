'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { useAuth } from '@/lib/auth';
import { subscribeNotifications } from '@/lib/notifications';
import { subscribeCustomerOrders } from '@/lib/orders';
import type { Notification, Order } from '@/lib/types';

const TABS = [
  { href: '/home',    label: 'Home',    icon: <path d="M3 11L12 3l9 8v10H3z" /> },
  { href: '/map',     label: 'Map',     icon: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></> },
  { href: '/orders',  label: 'Orders',  icon: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></> },
  { href: '/alerts',  label: 'Alerts',  icon: <><path d="M6 8a6 6 0 1 1 12 0v5l1.5 3h-15L6 13V8z"/><path d="M10 19a2 2 0 1 0 4 0"/></> },
  { href: '/profile', label: 'Profile', icon: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></> },
];

const STATUS_LABEL: Record<Order['status'], string> = {
  placed: 'Order received',
  accepted: 'Accepted',
  preparing: 'Being prepared',
  ready: 'Ready for pickup!',
  completed: '',
  cancelled: '',
};

export function CustomerNav() {
  const path = usePathname();
  const { user } = useAuth();
  const cart = useCart();
  const cartCount = cart?.lines.reduce((s, l) => s + l.qty, 0) || 0;
  const [unread, setUnread] = useState(0);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    return subscribeNotifications(user.uid, (items: Notification[]) => {
      setUnread(items.filter((n) => !n.read).length);
    });
  }, [user]);

  useEffect(() => {
    if (!user) { setActiveOrder(null); return; }
    return subscribeCustomerOrders(user.uid, (orders) => {
      setActiveOrder(orders.find((o) => !['completed','cancelled'].includes(o.status)) || null);
    });
  }, [user]);

  const onActiveOrderPage = activeOrder && path?.startsWith(`/orders/${activeOrder.id}`);

  return (
    <>
      {/* Active order banner — shows globally so the customer can jump to tracking from any screen */}
      {activeOrder && !onActiveOrderPage && (
        <Link
          href={`/orders/${activeOrder.id}`}
          className="fixed left-2 right-2 bottom-[80px] z-40 max-w-md mx-auto rounded-xl border border-accent/30 bg-accent/15 backdrop-blur px-3 py-2 flex items-center gap-2 shadow-lg"
        >
          <span className="live-dot flex-shrink-0" />
          <span className="text-xs font-bold flex-1 min-w-0 truncate">{STATUS_LABEL[activeOrder.status]} · {activeOrder.truck_name}</span>
          <span className="text-xs text-accent font-bold">Track →</span>
        </Link>
      )}

      <nav className="fixed left-0 right-0 bottom-0 z-40 border-t border-stroke bg-bg/95 backdrop-blur px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex">
          {TABS.map((t) => {
            const active = path === t.href || path?.startsWith(t.href + '/');
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex-1 py-2 flex flex-col items-center gap-1 text-[10px] font-semibold relative ${active ? 'text-white' : 'text-text-faint'}`}
                prefetch={false}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                     stroke={active ? '#FF3B7F' : 'currentColor'} strokeWidth="1.8"
                     strokeLinecap="round" strokeLinejoin="round">
                  {t.icon}
                </svg>
                {t.label}
                {t.href === '/orders' && cartCount > 0 && (
                  <span className="absolute top-0.5 right-[24%] min-w-[16px] h-4 px-1 grid place-items-center
                                   bg-accent rounded-full text-[10px] text-white font-bold">
                    {cartCount}
                  </span>
                )}
                {t.href === '/alerts' && unread > 0 && (
                  <span className="absolute top-0.5 right-[24%] min-w-[16px] h-4 px-1 grid place-items-center
                                   bg-accent rounded-full text-[10px] text-white font-bold">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
