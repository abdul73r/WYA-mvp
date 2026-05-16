'use client';
import { useEffect, useRef, useState } from 'react';

export interface AddressHit {
  display_name: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  onPick: (hit: AddressHit) => void;
  placeholder?: string;
  required?: boolean;
}

export function AddressAutocomplete({ value, onChange, onPick, placeholder, required }: Props) {
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const timerRef = useRef<any>();
  const lastQuery = useRef('');

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!value || value.trim().length < 3) {
      setHits([]); setOpen(false);
      return;
    }
    if (value === lastQuery.current) return;

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        const out: AddressHit[] = Array.isArray(data) ? data.map((h: any) => ({
          display_name: h.display_name,
          lat: parseFloat(h.lat),
          lng: parseFloat(h.lon),
        })) : [];
        setHits(out);
        setOpen(out.length > 0);
        setActive(-1);
        lastQuery.current = value;
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timerRef.current);
  }, [value]);

  function pick(h: AddressHit) {
    onChange(h.display_name);
    onPick(h);
    setOpen(false);
    setHits([]);
    lastQuery.current = h.display_name;
  }

  return (
    <div className="relative">
      <input
        className="input pr-9"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(hits[active]); }
          else if (e.key === 'Escape')    { setOpen(false); }
        }}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint text-xs pointer-events-none">
        {loading ? '⏳' : '🔍'}
      </div>
      {open && hits.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl border border-stroke bg-surface shadow-xl z-50">
          {hits.map((h, i) => (
            <button
              key={`${h.lat}-${h.lng}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(h)}
              className={`w-full text-left px-3 py-2.5 border-b border-stroke last:border-b-0 text-sm ${i === active ? 'bg-accent/10' : 'hover:bg-surface-2'}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-text-muted">📍</span>
                <span className="leading-snug">{h.display_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
