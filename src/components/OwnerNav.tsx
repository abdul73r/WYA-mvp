'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard',    label: 'Home',      icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></> },
  { href: '/orders-owner', label: 'Orders',    icon: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></> },
  { href: '/menu',         label: 'Menu',      icon: <><path d="M4 6h16M4 12h16M4 18h10"/></> },
  { href: '/analytics',    label: 'Analytics', icon: <><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></> },
  { href: '/owner-profile',label: 'Account',   icon: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></> },
];

export function OwnerNav() {
  const path = usePathname();
  return (
    <nav className="fixed left-0 right-0 bottom-0 z-40 border-t border-stroke bg-bg/95 backdrop-blur px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex">
        {TABS.map((t) => {
          const active = path === t.href || path?.startsWith(t.href + '/');
          return (
            <Link key={t.href} href={t.href} prefetch={false}
                  className={`flex-1 py-2 flex flex-col items-center gap-1 text-[10px] font-semibold ${active ? 'text-white' : 'text-text-faint'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke={active ? '#FF3B7F' : 'currentColor'} strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round">
                {t.icon}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
