import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'WYA — Find live food trucks near you',
  description: 'Discover, follow, and order from food trucks in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Leaflet (OpenStreetMap) — free, no API key */}
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" async />
      </body>
    </html>
  );
}
