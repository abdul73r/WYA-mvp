'use client';

export interface Coords { lat: number; lng: number; }

export function getCurrentLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Geolocation not supported'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/** Watch position; returns a cancel function. */
export function watchLocation(cb: (c: Coords) => void, onErr?: (e: GeolocationPositionError) => void) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => cb({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onErr?.(err),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Opens the system maps app with directions (Apple Maps on iOS, Google Maps elsewhere). */
export function openDirections(lat: number, lng: number, label?: string) {
  if (typeof window === 'undefined') return;
  const q = label ? `${label} @${lat},${lng}` : `${lat},${lng}`;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Haversine distance in miles between two coords. */
export function distanceMiles(a: Coords, b: Coords): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sLat1 = Math.sin(dLat / 2);
  const sLng1 = Math.sin(dLng / 2);
  const A = sLat1 * sLat1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sLng1 * sLng1;
  const C = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
  return R * C;
}
