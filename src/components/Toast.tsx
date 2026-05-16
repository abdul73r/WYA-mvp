'use client';
import { useEffect, useState } from 'react';

let push: ((msg: string) => void) | null = null;

export function showToast(msg: string) { push?.(msg); }

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    push = (msg) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s, { id, msg }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 2400);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="fixed left-4 right-4 bottom-24 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {items.map((t) => (
        <div key={t.id} className="px-4 py-2 rounded-lg bg-surface-2 border border-stroke-2 text-sm shadow-xl">
          {t.msg}
        </div>
      ))}
    </div>
  );
}
