'use client';
import { useEffect, useState } from 'react';
import type { Cart, CartLine } from './types';

const KEY = 'wya:cart:v2';

function read(): Cart | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function write(cart: Cart | null) {
  if (typeof window === 'undefined') return;
  if (cart) localStorage.setItem(KEY, JSON.stringify(cart));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('wya:cart'));
}

export function getCart(): Cart | null { return read(); }

export function addToCart(truckId: string, truckName: string, line: CartLine) {
  let cart = read();
  if (!cart || cart.truck_id !== truckId) {
    cart = { truck_id: truckId, truck_name: truckName, lines: [] };
  }
  const existing = cart.lines.find((l) => l.menu_item_id === line.menu_item_id);
  if (existing) {
    existing.qty += line.qty;
    if (line.notes) existing.notes = line.notes; // latest notes win
  } else {
    cart.lines.push(line);
  }
  write(cart);
}

export function setLineQty(menuItemId: string, qty: number) {
  const cart = read();
  if (!cart) return;
  const idx = cart.lines.findIndex((l) => l.menu_item_id === menuItemId);
  if (idx === -1) return;
  if (qty <= 0) cart.lines.splice(idx, 1);
  else cart.lines[idx].qty = qty;
  write(cart.lines.length ? cart : null);
}

export function setLineNotes(menuItemId: string, notes: string) {
  const cart = read();
  if (!cart) return;
  const line = cart.lines.find((l) => l.menu_item_id === menuItemId);
  if (!line) return;
  line.notes = notes;
  write(cart);
}

export function clearCart() { write(null); }

export function cartTotal(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.lines.reduce((s, l) => s + l.unit_price_cents * l.qty, 0);
}

export function useCart() {
  const [cart, setCart] = useState<Cart | null>(null);
  useEffect(() => {
    setCart(read());
    const onChange = () => setCart(read());
    window.addEventListener('wya:cart', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('wya:cart', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return cart;
}
