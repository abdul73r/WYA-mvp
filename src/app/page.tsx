'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

/**
 * Root entry. Routes the user to the right place based on auth + role.
 * - signed-out → /login
 * - customer   → /home
 * - owner with truck → /dashboard
 * - owner without truck → /setup
 */
export default function Index() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!profile) return; // wait for profile snapshot
    if (profile.role === 'owner') {
      router.replace(profile.truck_id ? '/dashboard' : '/setup');
    } else {
      router.replace('/home');
    }
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-text-muted text-sm">Loading WYA…</div>
    </div>
  );
}
