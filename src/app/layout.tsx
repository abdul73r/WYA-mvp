import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'WYA — Find live food trucks near you',
  description: 'Discover, follow, and order from food trucks in real time.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'WYA',
    statusBarStyle: 'black-translucent' as const,
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
};

export const viewport = {
  themeColor: '#FF3B7F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" async />
      </body>
    </html>
  );
}
