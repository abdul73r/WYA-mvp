'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { createTruck, updateTruck } from '@/lib/trucks';
import { uploadTruckImage } from '@/lib/storage';
import { RoleGuard } from '@/components/RoleGuard';
import { Spinner } from '@/components/Spinner';
import { BrandMark } from '@/components/BrandMark';
import type { CuisineTag } from '@/lib/types';

const CUISINES: CuisineTag[] = ['mexican','korean','halal','burgers','seafood','desserts','vegan','pizza','bbq','other'];

export default function SetupPage() {
  return (
    <RoleGuard allow={['owner']}>
      <Setup />
    </RoleGuard>
  );
}

function Setup() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState<CuisineTag>('mexican');
  const [hours, setHours] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (profile?.truck_id) {
    if (typeof window !== 'undefined') router.replace('/dashboard');
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setErr(null);
    try {
      const truckId = await createTruck(user.uid, { name, description, cuisine });
      const patch: any = {};
      if (hours) patch.hours = hours;
      if (logoFile) {
        patch.logo_url = await uploadTruckImage(user.uid, truckId, 'logo', logoFile);
      }
      if (Object.keys(patch).length) await updateTruck(truckId, patch);
      router.replace('/dashboard');
    } catch (e: any) {
      setErr(e?.message || 'Failed to create truck');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-7 pt-16 pb-10 page-enter">
      <BrandMark size={48} />
      <h1 className="text-3xl font-extrabold mt-6 tracking-tight">Set up your truck</h1>
      <p className="text-text-muted mt-1 text-sm">This is what customers will see in WYA.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 mt-7">
        <div>
          <label className="field-label">Truck name *</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tony's Tacos" />
        </div>
        <div>
          <label className="field-label">Cuisine *</label>
          <select className="input" value={cuisine} onChange={(e) => setCuisine(e.target.value as CuisineTag)}>
            {CUISINES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Description</label>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Best birria in Brooklyn. Roving daily." />
        </div>
        <div>
          <label className="field-label">Hours (optional)</label>
          <input className="input" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Fri 11am – 9pm" />
        </div>
        <div>
          <label className="field-label">Logo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                 className="text-sm text-text-muted" />
          {logoFile && (
            <div className="w-24 h-24 rounded-xl bg-surface-2 overflow-hidden mt-3">
              <img src={URL.createObjectURL(logoFile)} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        {err && <div className="text-sm text-accent">{err}</div>}
        <button className="btn primary block mt-2" type="submit" disabled={busy}>
          {busy ? <Spinner /> : 'Create truck'}
        </button>
      </form>
    </div>
  );
}
