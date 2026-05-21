'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GeoPoint } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import { BrandMark } from '@/components/BrandMark';
import { Spinner } from '@/components/Spinner';
import { createTruck, updateTruck } from '@/lib/trucks';
import { uploadTruckImage } from '@/lib/storage';
import { geocodeAddress } from '@/lib/geocode';
import { AddressAutocomplete, AddressHit } from '@/components/AddressAutocomplete';
import type { CuisineTag, Role } from '@/lib/types';

const CUISINES: CuisineTag[] = ['mexican','korean','halal','burgers','seafood','desserts','vegan','pizza','bbq','other'];

// Wrap the form in a Suspense boundary so useSearchParams doesn't break the build.
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><Spinner /></div>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signUp } = useAuth();
  const initialRole = (params.get('role') === 'owner' ? 'owner' : 'customer') as Role;
  const [role, setRole] = useState<Role>(initialRole);

  // If someone hits /signup?role=owner from the landing, lock the role choice in
  useEffect(() => {
    const r = params.get('role');
    if (r === 'owner' || r === 'customer') setRole(r);
  }, [params]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [truckName, setTruckName] = useState('');
  const [cuisine, setCuisine] = useState<CuisineTag>('mexican');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [address, setAddress] = useState('');
  const [pickedAddress, setPickedAddress] = useState<AddressHit | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bankHolder, setBankHolder] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Creating account…');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (role === 'owner' && !truckName.trim()) throw new Error('Enter your truck name.');
      if (role === 'owner' && !address.trim()) throw new Error('Enter your parking address — customers see this on the map when you go live.');

      // Resolve the parking address: prefer the user's picked suggestion, else geocode the text.
      let geocoded: { lat: number; lng: number; display_name: string } | null = null;
      if (role === 'owner') {
        if (pickedAddress) {
          geocoded = pickedAddress;
        } else {
          setBusyLabel('Finding that address…');
          geocoded = await geocodeAddress(address);
          if (!geocoded) {
            throw new Error('Couldn’t find that address. Pick one from the dropdown or try a more specific one.');
          }
        }
      }

      setBusyLabel('Creating account…');
      const uid = await signUp(email, password, name, role);

      if (role === 'owner') {
        setBusyLabel('Setting up your truck…');
        const truckId = await createTruck(uid, { name: truckName, description, cuisine });

        const patch: any = {
          address: address.trim(),
        };
        if (geocoded) {
          patch.address_label = geocoded.display_name;
          patch.location = new GeoPoint(geocoded.lat, geocoded.lng);
        }
        if (hours) patch.hours = hours;
        if (bankHolder && bankAccount && bankAccount.length >= 4) {
          patch.bank_holder_name = bankHolder.trim();
          patch.bank_account_last4 = bankAccount.slice(-4);
        }
        if (logoFile) {
          setBusyLabel('Uploading logo…');
          patch.logo_url = await uploadTruckImage(uid, truckId, 'logo', logoFile);
        }
        await updateTruck(truckId, patch);
        router.replace('/dashboard');
      } else {
        router.replace('/home');
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Sign-up failed');
    } finally {
      setBusy(false);
      setBusyLabel('Creating account…');
    }
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-7 pt-16 pb-10 page-enter">
      <BrandMark size={48} />
      <h1 className="text-3xl font-extrabold mt-6 tracking-tight">Create your account</h1>
      <p className="text-text-muted mt-1 text-sm">Pick the type of account that fits you.</p>

      <div className="grid grid-cols-2 gap-2 mt-6">
        <button
          type="button"
          onClick={() => setRole('customer')}
          className={`p-4 text-left rounded-xl border ${role === 'customer' ? 'border-accent bg-accent/10' : 'border-stroke bg-surface'}`}
        >
          <div className="text-xs uppercase tracking-widest text-text-muted">I'm a</div>
          <div className="font-bold mt-1">Customer</div>
          <div className="text-xs text-text-muted mt-1">Find &amp; order from trucks</div>
        </button>
        <button
          type="button"
          onClick={() => setRole('owner')}
          className={`p-4 text-left rounded-xl border ${role === 'owner' ? 'border-accent bg-accent/10' : 'border-stroke bg-surface'}`}
        >
          <div className="text-xs uppercase tracking-widest text-text-muted">I'm a</div>
          <div className="font-bold mt-1">Truck owner</div>
          <div className="text-xs text-text-muted mt-1">List my truck and take orders</div>
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-7">
        <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold mt-1">Account</h2>
        <div>
          <label className="field-label">Full name *</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="field-label">Email *</label>
          <input className="input" type="email" required value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </div>
        <div>
          <label className="field-label">Password *</label>
          <input className="input" type="password" required minLength={6}
                 value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </div>

        {role === 'owner' && (
          <>
            <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold mt-2">Your truck</h2>
            <div>
              <label className="field-label">Truck name *</label>
              <input className="input" required value={truckName} onChange={(e) => setTruckName(e.target.value)} placeholder="Tony's Tacos" />
            </div>
            <div>
              <label className="field-label">Cuisine *</label>
              <select className="input" value={cuisine} onChange={(e) => setCuisine(e.target.value as CuisineTag)}>
                {CUISINES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Short description</label>
              <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                        placeholder="Best birria in Brooklyn." />
            </div>
            <div>
              <label className="field-label">Hours</label>
              <input className="input" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Fri 11am – 9pm" />
            </div>
            <div>
              <label className="field-label">Parking address *</label>
              <AddressAutocomplete
                value={address}
                onChange={(t) => { setAddress(t); setPickedAddress(null); }}
                onPick={(h) => { setAddress(h.display_name); setPickedAddress(h); }}
                placeholder="Start typing an address…"
                required
              />
              {pickedAddress && (
                <div className="text-[11px] text-success mt-1">✓ Address pinned</div>
              )}
              <div className="text-[11px] text-text-muted mt-1">
                Where you normally park. Customers see this pin when you go live. If you move while live, your real GPS overrides it.
              </div>
            </div>
            <div>
              <label className="field-label">Logo (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="text-sm text-text-muted" />
              {logoFile && (
                <div className="w-20 h-20 rounded-xl bg-surface-2 overflow-hidden mt-3">
                  <img src={URL.createObjectURL(logoFile)} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold mt-2">Payout info</h2>
            <div className="text-[11px] text-text-muted -mt-2">
              Order revenue (minus our 5% fee) lands in your wallet. Transfer it out anytime.
              MVP only stores the last 4 digits — real bank info is collected by Stripe Connect later.
            </div>
            <div>
              <label className="field-label">Name on bank account</label>
              <input className="input" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} placeholder="As shown on your account" />
            </div>
            <div>
              <label className="field-label">Account number (last 4 only saved)</label>
              <input className="input" inputMode="numeric" value={bankAccount}
                     onChange={(e) => setBankAccount(e.target.value.replace(/[^0-9]/g, ''))}
                     placeholder="•••• 1234" />
            </div>
          </>
        )}

        {err && <div className="text-sm text-accent">{err}</div>}

        <button className="btn primary block mt-2" type="submit" disabled={busy}>
          {busy ? <><Spinner /><span className="ml-2 text-sm">{busyLabel}</span></> : (role === 'owner' ? 'Create truck account' : 'Create account')}
        </button>
      </form>

      <p className="text-center text-sm text-text-muted mt-8">
        Already have an account? <Link className="text-accent font-semibold" href="/login">Sign in</Link>
      </p>
    </div>
  );
}
