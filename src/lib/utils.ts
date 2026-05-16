export function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function relativeTime(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export function classNames(...x: (string | false | null | undefined)[]) {
  return x.filter(Boolean).join(' ');
}
