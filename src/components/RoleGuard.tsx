'use client';
import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from './Spinner';
import type { Role } from '@/lib/types';

interface Props {
  allow: Role[];
  children: ReactNode;
}

export function RoleGuard({ allow, children }: Props) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!profile) return;
    if (!allow.includes(profile.role)) {
      router.replace(profile.role === 'owner'
        ? (profile.truck_id ? '/dashboard' : '/setup')
        : '/home');
    }
  }, [user, profile, loading, router, allow]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!allow.includes(profile.role)) return null;
  return <>{children}</>;
}
