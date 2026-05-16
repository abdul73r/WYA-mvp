'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { OwnerNav } from '@/components/OwnerNav';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth';
import {
  addItem, deleteItem, groupBySection, reorderItem, subscribeMenu, toggleSoldOut, updateItem,
} from '@/lib/menu';
import { uploadTruckImage } from '@/lib/storage';
import { showToast, ToastHost } from '@/components/Toast';
import type { DietaryTag, MenuItem } from '@/lib/types';
import { dollars } from '@/lib/utils';

const TAGS: { key: DietaryTag; label: string }[] = [
  { key: 'vegan',       label: 'Vegan' },
  { key: 'vegetarian',  label: 'Vegetarian' },
  { key: 'gluten_free', label: 'GF' },
  { key: 'spicy',       label: 'Spicy' },
  { key: 'halal',       label: 'Halal' },
  { key: 'kosher',      label: 'Kosher' },
  { key: 'dairy_free',  label: 'Dairy-free' },
  { key: 'nut_free',    label: 'Nut-free' },
];

export default function MenuPage() {
  return (
    <RoleGuard allow={['owner']}>
      <Menu />
      <OwnerNav />
      <ToastHost />
    </RoleGuard>
  );
}

function Menu() {
  const { user, profile } = useAuth();
  const truckId = profile?.truck_id;
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);

  useEffect(() => { if (!truckId) router.replace('/setup'); }, [truckId, router]);
  useEffect(() => { if (!truckId) return; return subscribeMenu(truckId, setItems); }, [truckId]);

  if (!truckId) return null;
  const groups = items ? groupBySection(items) : [];

  async function move(it: MenuItem, dir: 'up' | 'down', siblings: MenuItem[]) {
    await reorderItem(truckId!, it, dir, siblings);
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24 page-enter">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
        <h1 className="text-lg font-bold flex-1">Menu</h1>
        <button className="btn sm primary" onClick={() => setEditing('new')}>+ Add item</button>
      </header>

      {items === null && <div className="p-10 grid place-items-center"><Spinner /></div>}

      {items && items.length === 0 && (
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-stroke grid place-items-center text-3xl mx-auto mb-3">🍽️</div>
          <div className="font-bold">Add your first menu item</div>
          <div className="text-text-muted text-sm mt-1">Customers see your menu on your truck profile.</div>
          <button className="btn primary mt-5" onClick={() => setEditing('new')}>+ Add item</button>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.section} className="mt-3">
          <div className="px-5 py-2 text-xs uppercase tracking-widest text-text-muted font-bold bg-surface-2">{g.section}</div>
          {g.items.map((it, i) => (
            <div key={it.id} className="px-5 py-3 border-b border-stroke flex gap-3 items-center">
              <div className="w-16 h-16 rounded-xl bg-surface-2 overflow-hidden flex-shrink-0 relative">
                {it.photo_url ? <img src={it.photo_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-2xl">🍽️</div>}
                {it.sold_out && (
                  <div className="absolute inset-0 bg-black/65 grid place-items-center">
                    <span className="text-[9px] font-extrabold tracking-widest">SOLD</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{it.name}</div>
                <div className="text-xs text-text-muted">
                  {dollars(it.price_cents)}
                  {it.prep_minutes ? ` · ${it.prep_minutes} min prep` : ''}
                </div>
                {it.tags && it.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {it.tags.slice(0, 4).map((t) => (
                      <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-2 text-text-muted capitalize">{t.replace('_',' ')}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-1">
                  <button
                    onClick={() => move(it, 'up', g.items)}
                    disabled={i === 0}
                    className="w-7 h-7 rounded-md bg-surface-2 border border-stroke disabled:opacity-40 grid place-items-center text-xs"
                    aria-label="Move up"
                  >↑</button>
                  <button
                    onClick={() => move(it, 'down', g.items)}
                    disabled={i === g.items.length - 1}
                    className="w-7 h-7 rounded-md bg-surface-2 border border-stroke disabled:opacity-40 grid place-items-center text-xs"
                    aria-label="Move down"
                  >↓</button>
                </div>
                <div className="flex gap-1">
                  <button className="btn sm" onClick={() => setEditing(it)}>Edit</button>
                  <button className="btn sm" onClick={() => toggleSoldOut(truckId!, it.id, !it.sold_out)}>
                    {it.sold_out ? 'Restock' : 'Sold out'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {editing && (
        <ItemEditor
          truckId={truckId!}
          ownerUid={user!.uid}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ItemEditor({ truckId, ownerUid, item, onClose }: {
  truckId: string; ownerUid: string; item: MenuItem | null; onClose: () => void;
}) {
  const [name, setName] = useState(item?.name || '');
  const [section, setSection] = useState(item?.section || 'Menu');
  const [description, setDescription] = useState(item?.description || '');
  const [price, setPrice] = useState(item ? (item.price_cents / 100).toFixed(2) : '');
  const [prep, setPrep] = useState(item?.prep_minutes ? String(item.prep_minutes) : '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState(item?.photo_url || '');
  const [tags, setTags] = useState<DietaryTag[]>(item?.tags || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleTag(t: DietaryTag) {
    setTags((curr) => curr.includes(t) ? curr.filter((x) => x !== t) : [...curr, t]);
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      const price_cents = Math.round(parseFloat(price) * 100);
      if (!name.trim() || !price_cents || price_cents < 0) throw new Error('Name and price are required.');
      const prep_minutes = prep ? Math.max(0, Math.min(120, parseInt(prep))) : 0;

      let finalPhoto = photoUrl.trim() || undefined;
      if (photoFile) finalPhoto = await uploadTruckImage(ownerUid, truckId, 'menu', photoFile);

      if (!item) {
        await addItem(truckId, { name, description, price_cents, photo_url: finalPhoto, section, tags, prep_minutes });
        showToast('Item added');
      } else {
        const patch: any = { name, description, price_cents, section, tags, prep_minutes };
        if (finalPhoto !== undefined) patch.photo_url = finalPhoto;
        await updateItem(truckId, item.id, patch);
        showToast('Item updated');
      }
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
    } finally { setBusy(false); }
  }

  async function onDelete() {
    if (!item) return;
    if (!confirm('Delete this item?')) return;
    await deleteItem(truckId, item.id);
    showToast('Deleted');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <div className="bg-bg max-w-md mx-auto w-full border-t border-stroke rounded-t-2xl p-5 pb-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{item ? 'Edit item' : 'New menu item'}</h2>
          <button onClick={onClose} className="text-text-muted text-sm">Close</button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="field-label">Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Birria Tacos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Price (USD) *</label>
              <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="12.50" />
            </div>
            <div>
              <label className="field-label">Section</label>
              <input className="input" value={section} onChange={(e) => setSection(e.target.value)} placeholder="Tacos" />
            </div>
          </div>
          <div>
            <label className="field-label">Prep time (minutes)</label>
            <input className="input" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="10" />
            <div className="text-[11px] text-text-muted mt-1">Shown to customers as the pickup ETA for this item.</div>
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Slow-braised beef, melted cheese, consomé" />
          </div>
          <div>
            <label className="field-label">Dietary tags</label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTag(t.key)}
                  className={`chip ${tags.includes(t.key) ? 'active' : ''}`}
                >{t.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Photo URL</label>
            <input className="input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="field-label">Or upload</label>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="text-sm text-text-muted" />
          </div>
          {(photoFile || photoUrl) && (
            <div className="w-32 h-32 rounded-xl bg-surface-2 overflow-hidden">
              <img src={photoFile ? URL.createObjectURL(photoFile) : photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {err && <div className="text-sm text-accent">{err}</div>}
          <div className="flex gap-2 mt-2">
            <button onClick={save} className="btn primary block" disabled={busy}>{busy ? <Spinner /> : 'Save'}</button>
            {item && <button onClick={onDelete} className="btn danger">Delete</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
