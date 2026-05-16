'use client';

/**
 * Converts a free-text address to coordinates using OpenStreetMap's Nominatim API.
 * Free, no API key. Be respectful — call at most once per user action.
 */
export interface GeocodeHit {
  lat: number;
  lng: number;
  display_name: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeHit | null> {
  const q = (address || '').trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const top = data[0];
    return {
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      display_name: top.display_name,
    };
  } catch {
    return null;
  }
}
