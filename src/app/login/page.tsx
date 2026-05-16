'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { BrandMark } from '@/components/BrandMark';
import { Spinner } from '@/components/Spinner';

export default function LoginPage() {
  const { user, profile, signIn, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // already signed in? route to the right place
  useEffect(() => {
    if (loading || !user || !profile) return;
    router.replace(profile.role === 'owner' ? (profile.truck_id ? '/dashboard' : '/setup') : '/home');
  }, [user, profile, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await signIn(email, password); }
    catch (e: any) { setErr(e?.message ?? 'Sign-in failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-7 pt-20 pb-10 flex flex-col">
      <BrandMark size={48} />
      <h1 className="text-3xl font-extrabold mt-6 tracking-tight">Welcome back</h1>
      <p className="text-text-muted mt-1 text-sm">Find every food truck near you, in real time.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 mt-7">
        <div>
          <label className="field-label">Email</label>
          <input className="input" type="email" required autoComplete="email"
                 value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <label className="field-label">Password</label>
          <input className="input" type="password" required autoComplete="current-password"
                 value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {err && <div className="text-sm text-accent">{err}</div>}
        <button className="btn primary block mt-2" type="submit" disabled={busy}>
          {busy ? <Spinner /> : 'Continue'}
        </button>
      </form>

      <p className="text-center text-sm text-text-muted mt-8">
        New here? <Link className="text-accent font-semibold" href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
