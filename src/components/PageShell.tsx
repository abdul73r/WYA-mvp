import { ReactNode } from 'react';

export function PageShell({
  title,
  right,
  children,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto page-enter">
      {title && (
        <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-stroke px-5 py-3 flex items-center gap-3">
          <h1 className="text-lg font-bold flex-1 truncate">{title}</h1>
          {right}
        </header>
      )}
      {children}
    </div>
  );
}
