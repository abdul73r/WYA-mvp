'use client';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { MenuItem, DietaryTag } from './types';

function path(truckId: string) {
  return collection(db, 'food_trucks', truckId, 'menu_items');
}

export async function listMenu(truckId: string): Promise<MenuItem[]> {
  const qs = await getDocs(query(path(truckId), orderBy('position', 'asc')));
  return qs.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
}

export function subscribeMenu(truckId: string, cb: (items: MenuItem[]) => void): Unsubscribe {
  const q = query(path(truckId), orderBy('position', 'asc'));
  return onSnapshot(q, (qs) =>
    cb(qs.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem))),
  );
}

export async function addItem(truckId: string, data: {
  name: string; description: string; price_cents: number; photo_url?: string;
  section?: string; tags?: DietaryTag[]; prep_minutes?: number; position?: number;
}) {
  const ref = await addDoc(path(truckId), {
    truck_id: truckId,
    name: data.name.trim(),
    description: data.description.trim(),
    price_cents: data.price_cents,
    photo_url: data.photo_url || '',
    sold_out: false,
    section: (data.section || '').trim() || 'Menu',
    tags: data.tags || [],
    prep_minutes: data.prep_minutes || 0,
    position: data.position ?? Date.now(),
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function updateItem(truckId: string, itemId: string, patch: Partial<MenuItem>) {
  await updateDoc(doc(db, 'food_trucks', truckId, 'menu_items', itemId), patch as any);
}

export async function toggleSoldOut(truckId: string, itemId: string, soldOut: boolean) {
  await updateDoc(doc(db, 'food_trucks', truckId, 'menu_items', itemId), { sold_out: soldOut });
}

export async function deleteItem(truckId: string, itemId: string) {
  await deleteDoc(doc(db, 'food_trucks', truckId, 'menu_items', itemId));
}

export async function reorderItem(truckId: string, item: MenuItem, direction: 'up' | 'down', siblings: MenuItem[]) {
  const idx = siblings.findIndex((x) => x.id === item.id);
  if (idx === -1) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const other = siblings[swapIdx];
  await updateItem(truckId, item.id,  { position: other.position });
  await updateItem(truckId, other.id, { position: item.position });
}

export function groupBySection(items: MenuItem[]): { section: string; items: MenuItem[] }[] {
  const groups = new Map<string, MenuItem[]>();
  for (const it of items) {
    const key = (it.section || 'Menu').trim() || 'Menu';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  return Array.from(groups.entries()).map(([section, list]) => ({ section, items: list }));
}
