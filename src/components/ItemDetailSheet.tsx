'use client';
import { useEffect, useState } from 'react';
import type { MenuItem, DietaryTag } from '@/lib/types';
import { dollars } from '@/lib/utils';

const TAG_LABEL: Record<DietaryTag, string> = {
  vegan: '🌱 Vegan',
  vegetarian: '🥗 Vegetarian',
  gluten_free: 'GF',
  spicy: '🌶 Spicy',
  halal: 'Halal',
  kosher: 'Kosher',
  dairy_free: 'Dairy-free',
  nut_free: 'Nut-free',
};

interface Props {
  item: MenuItem | null;
  truckName?: string;
  onClose: () => void;
  onAdd: (qty: number, notes: string) => void;
}

export function ItemDetailSheet({ item, truckName, onClose, onAdd }: Props) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) { setQty(1); setNotes(''); }
  }, [item?.id]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <div
        className="bg-bg max-w-md mx-auto w-full border-t border-stroke rounded-t-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div className="aspect-[5/3] bg-surface-2">
            {item.photo_url
              ? <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center text-6xl">🍽️</div>}
          </div>
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-bg/80 border border-stroke grid place-items-center text-text-muted backdrop-blur">
            ✕
          </button>
        </div>

        <div className="p-5">
          <h2 className="text-2xl font-extrabold leading-tight">{item.name}</h2>
          {truckName && <div className="text-xs text-text-muted mt-0.5">{truckName}</div>}

          {item.description && (
            <p className="text-sm text-text-muted mt-3 leading-relaxed">{item.description}</p>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {item.tags.map((t) => (
                <span key={t} className="text-[10px] font-bold px-2 py-1 rounded-full bg-surface border border-stroke text-text-muted">
                  {TAG_LABEL[t] || t}
                </span>
              ))}
            </div>
          )}

          <div className="text-xl font-bold mt-4">{dollars(item.price_cents)}</div>

          <div className="mt-5">
            <label className="field-label">Special instructions (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="No onions, extra sauce, etc."
            />
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="inline-flex items-center gap-1 bg-surface border border-stroke rounded-full p-1">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-9 h-9 rounded-full hover:bg-surface-2 font-bold text-lg"
              >−</button>
              <span className="px-2 text-base font-semibold min-w-[24px] text-center">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-9 h-9 rounded-full hover:bg-surface-2 font-bold text-lg"
              >+</button>
            </div>
            <button
              onClick={() => onAdd(qty, notes)}
              disabled={item.sold_out}
              className="btn primary flex-1 flex justify-between"
            >
              <span>{item.sold_out ? 'Sold out' : 'Add to cart'}</span>
              <span className="font-bold">{dollars(item.price_cents * qty)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
