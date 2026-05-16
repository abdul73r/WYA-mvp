'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GeoPoint } from 'firebase/firestore';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import { getTruck, updateTruck } from '@/lib/trucks';
import { uploadTruckImage } from '@/lib/storage';
import { geocodeAddress } from '@/lib/geocode';
import { AddressAutocomplete, AddressHit } from '@/components/AddressAutocomplete';
import { showToast, ToastHost } from '@/components/Toast';
import type { CuisineTag, FoodTruck } from '@/lib/types';

const CUISINES: CuisineTag[] = ['mexican','korean','halal','burgers','seafood','desserts','vegan','pizza','bbq','other'];

export default function TruckEditPage() {
  return (
    <RoleGuard allow={['owner']}>
      <TruckEdit />
      <OwnerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function TruckEdit() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const truckId = profile?.truck_id;
  const [truck, setTruck] = useState<FoodTruck | null>(null);

  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState<CuisineTag>('mexican');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [address, setAddress] = useState('');
  const [addressDirty, setAddressDirty] = useState(false);
  const [pickedAddress, setPickedAddress] = useState<AddressHit | null>(null);
  const [promotion, setPromotion] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Saving…');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!truckId) router.replace('/setup'); }, [truckId, router]);
  useEffect(() => {
    if (!truckId) return;
    getTruck(truckId).then((t) => {
      if (!t) return;
      setTruck(t);
      setName(t.name);
      setCuisine(t.cuisine);
      setDescription(t.description || '');
      setHours(t.hours || '');
      setAddress(t.address || '');
      setPromotion(t.promotion || '');
    });
  }, [truckId]);

  async function save() {
    if (!truck || !user) return;
    setBusy(true); setErr(null);
    try {
      const patch: any = { name, cuisine, description, hours, promotion };

      // Re-resolve only if the address changed. Picked dropdown wins; else geocode the text.
      if (addressDirty && address.trim()) {
        let hit: { lat: number; lng: number; display_name: string } | null = pickedAddress;
        if (!hit) {
          setBusyLabel('Finding that address…');
          hit = await geocodeAddress(address);
          if (!hit) {
            throw new Error('Couldn’t find that address. Pick one from the dropdown.');
          }
        }
        patch.address = hit.display_name;
        patch.address_label = hit.display_name;
        patch.location = new GeoPoint(hit.lat, hit.lng);
      } else if (addressDirty && !address.trim()) {
        patch.address = '';
        patch.address_label = '';
      }

      setBusyLabel('Saving…');
      if (logoFile)  patch.logo_url  = await uploadTruckImage(user.uid, truck.id, 'logo', logoFile);
      if (coverFile) patch.cover_url = await uploadTruckImage(user.uid, truck.id, 'cover', coverFile);
      await updateTruck(truck.id, patch);
      showToast('Saved');
      router.replace('/dashboard');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
    } finally { setBusy(false); setBusyLabel('Saving…'); }
  }

  if (!truck) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-28 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-surface border border-stroke grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 className="text-lg font-bold flex-1">Edit truck</h1>
        <button onClick={save} className="btn sm primary" disabled={busy}>{busy ? <Spinner /> : 'Save'}</button>
      </header>

      <div className="px-5 mt-4 flex flex-col gap-4">
        <div>
          <label className="field-label">Logo</label>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-2xl bg-surface border border-stroke overflow-hidden grid place-items-center text-2xl">
              {logoFile
                ? <img src={URL.createObjectURL(logoFile)} alt="" className="w-full h-full object-cover" />
                : truck.logo_url
                  ? <img src={truck.logo_url} alt="" className="w-full h-full object-cover" />
                  : '🚚'}
            </div>
            <label className="btn sm cursor-pointer">
              Replace
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        <div>
          <label className="field-label">Cover image</label>
          <div className="rounded-xl border border-stroke bg-surface overflow-hidden h-28 mb-2">
            {coverFile
              ? <img src={URL.createObjectURL(coverFile)} alt="" className="w-full h-full object-cover" />
              : truck.cover_url
                ? <img src={truck.cover_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full grid place-items-center text-text-muted text-sm">No cover image yet</div>}
          </div>
          <label className="btn sm cursor-pointer inline-flex">
            Replace cover
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div>
          <label className="field-label">Truck name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="field-label">Cuisine *</label>
          <select className="input" value={cuisine} onChange={(e) => setCuisine(e.target.value as CuisineTag)}>
            {CUISINES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="field-label">Hours</label>
          <input className="input" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Fri 11am – 9pm" />
        </div>

        <div>
          <label className="field-label">Parking address</label>
          <AddressAutocomplete
            value={address}
            onChange={(t) => { setAddress(t); setAddressDirty(true); setPickedAddress(null); }}
            onPick={(h) => { setAddress(h.display_name); setAddressDirty(true); setPickedAddress(h); }}
            placeholder="Start typing an address…"
          />
          {pickedAddress && <div className="text-[11px] text-success mt-1">✓ New address pinned</div>}
          {!addressDirty && truck.address_label && (
            <div className="text-[11px] text-text-muted mt-1 truncate">📍 Currently: {truck.address_label}</div>
          )}
          <div className="text-[11px] text-text-muted mt-1">
            This is where your truck pin shows on the map when you go live. If you move while live, the app uses your real GPS instead.
          </div>
        </div>

        <div>
          <label className="field-label">Current promotion (shown to customers)</label>
          <input className="input" value={promotion} onChange={(e) => setPromotion(e.target.value)} placeholder="e.g. 20% off all tacos today" />
          <div className="text-[11px] text-text-muted mt-1">Leave blank to hide the promo banner.</div>
        </div>

        {err && <div className="text-sm text-accent">{err}</div>}

        <button onClick={save} className="btn primary block" disabled={busy}>
          {busy ? <><Spinner /><span className="ml-2 text-sm">{busyLabel}</span></> : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
