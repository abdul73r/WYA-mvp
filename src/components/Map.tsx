'use client';
import { useEffect, useRef } from 'react';

declare global {
  interface Window { L: any }
}

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  image?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface MapProps {
  center: { lat: number; lng: number };
  pins?: MapPin[];
  meCoords?: { lat: number; lng: number };
  zoom?: number;
  focusOn?: string;
}

function pinHtml(p: MapPin) {
  const color = p.active ? '#FF3B7F' : '#FFFFFF';
  const ringColor = p.active ? 'rgba(255,59,127,0.9)' : 'rgba(255,255,255,0.6)';
  const inner = p.image
    ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="" />`
    : `<span style="font-size:18px">🍴</span>`;
  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <div style="position:absolute;inset:-3px;border-radius:50%;border:2px solid ${ringColor};opacity:.5;animation:wya-pulse 2s ease-out infinite"></div>
      <div style="width:44px;height:44px;border-radius:50%;background:#fff;border:3px solid ${color};display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.55);overflow:hidden">${inner}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-2px"></div>
    </div>`;
}

export function Map({ center, pins = [], meCoords, zoom = 14, focusOn }: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  // marker store keyed by pin id — plain object to avoid name clash with the `Map` component
  const markersRef = useRef<{ [id: string]: any }>({});
  const meMarkerRef = useRef<any>(null);

  // Initialize the Leaflet map once Leaflet's CDN script is ready
  useEffect(() => {
    let cancelled = false;
    function tryInit() {
      if (cancelled) return;
      if (!window.L || !containerRef.current) { setTimeout(tryInit, 80); return; }
      if (mapRef.current) return;
      const L = window.L;
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '',
      }).addTo(map);
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      mapRef.current = map;
    }
    tryInit();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setView([center.lat, center.lng], zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!focusOn || !mapRef.current) return;
    const target = pins.find((p) => p.id === focusOn);
    if (!target) return;
    mapRef.current.flyTo([target.lat, target.lng], Math.max(15, mapRef.current.getZoom()), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOn]);

  // me marker
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    if (meMarkerRef.current) { meMarkerRef.current.remove(); meMarkerRef.current = null; }
    if (meCoords) {
      const icon = L.divIcon({
        className: 'wya-me-dot',
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#4D86FF;border:3px solid #fff;box-shadow:0 0 0 6px rgba(77,134,255,.25)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      meMarkerRef.current = L.marker([meCoords.lat, meCoords.lng], { icon }).addTo(mapRef.current);
    }
  }, [meCoords?.lat, meCoords?.lng]);

  // truck pins — diff against the existing marker store so updates animate smoothly
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    const store = markersRef.current;
    const ids = new Set(pins.map((p) => p.id));

    // Remove markers that are no longer in the list
    Object.keys(store).forEach((id) => {
      if (!ids.has(id)) {
        try { store[id].remove(); } catch {}
        delete store[id];
      }
    });

    // Add or update remaining pins
    pins.forEach((p) => {
      const icon = L.divIcon({
        className: 'wya-truck-pin',
        html: pinHtml(p),
        iconSize: [44, 52],
        iconAnchor: [22, 52],
      });
      let m = store[p.id];
      if (!m) {
        m = L.marker([p.lat, p.lng], { icon }).addTo(mapRef.current);
        store[p.id] = m;
      } else {
        m.setLatLng([p.lat, p.lng]);
        m.setIcon(icon);
      }
      m.off('click');
      if (p.onClick) m.on('click', p.onClick);
    });
  }, [pins.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.active ? 1 : 0}:${p.image || ''}`).join(',')]);

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0A0C12' }} />
      <style jsx global>{`
        @keyframes wya-pulse {
          from { transform: scale(.6); opacity: .8; }
          to   { transform: scale(2.4); opacity: 0; }
        }
        .leaflet-container { background: #0A0C12 !important; }
        .leaflet-control-zoom a {
          background: rgba(20,23,31,.92) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,.07) !important;
        }
      `}</style>
    </>
  );
}
