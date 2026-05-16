export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block animate-spin rounded-full border-2 border-white/20 border-t-white ${className}`}
         style={{ width: 18, height: 18 }} />
  );
}
