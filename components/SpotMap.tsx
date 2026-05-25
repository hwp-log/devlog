'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Spot } from '@prisma/client';

// interactive prop: 0046b에서 onMapClick 호출 여부 제어용. mapboxgl.Map의 interactive 옵션과는 무관.
type Props = {
  spots: Spot[];
  initialCenter?: [number, number]; // [lng, lat]
  interactive?: boolean;
  onSpotClick?: (spot: Spot) => void;
  onMapClick?: (lng: number, lat: number) => void;
};

export default function SpotMap({
  spots,
  initialCenter,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [is3D, setIs3D] = useState(true);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!containerRef.current || !token) return;

    mapboxgl.accessToken = token;

    const center: [number, number] =
      spots.length > 0
        ? [spots[0].lng, spots[0].lat]
        : (initialCenter ?? [126.978, 37.566]);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center,
      zoom: 12,
      pitch: 60,
    });

    map.on('style.load', () => {
      map.setConfigProperty('basemap', 'lightPreset', 'dusk');
    });

    spots.forEach((spot, i) => {
      const el = document.createElement('div');
      el.textContent = String(i + 1);
      Object.assign(el.style, {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: '#0ea5e9',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        border: '2px solid #fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        cursor: 'default',
      });
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({ pitch: is3D ? 60 : 0, duration: 1000 });
  }, [is3D]);

  if (!token) {
    return (
      <div className="w-full h-[400px] rounded-xl bg-slate-100 flex items-center justify-center text-sm text-slate-500">
        지도를 표시하려면 Mapbox 토큰이 필요합니다.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <button
        type="button"
        onClick={() => setIs3D((prev) => !prev)}
        className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm
                   text-slate-700 text-xs font-medium px-3 py-1.5
                   rounded-lg shadow-md hover:bg-white transition-colors"
      >
        {is3D ? '2D' : '3D'}
      </button>
    </div>
  );
}
