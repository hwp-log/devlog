'use client';

import { useRef, useEffect, useState, useTransition } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { LocalSpot } from '@/lib/types';
import { SpotList } from './SpotList';
import { SpotPopup } from './SpotPopup';
import { getSpotColor } from '@/lib/spot-color';

// interactive prop: 0046b에서 onMapClick 호출 여부 제어용. mapboxgl.Map의 interactive 옵션과는 무관.
type Props = {
  spots: LocalSpot[];
  initialCenter?: [number, number]; // [lng, lat]
  interactive?: boolean;
  onSpotClick?: (spot: LocalSpot) => void;
  onMapClick?: (lng: number, lat: number) => void;
  canAddSpot?: boolean;
  onSpotsChange?: (spots: LocalSpot[]) => void;
  onPhotoSelect?: (spotId: string, file: File | null) => void;
};

export default function SpotMap({
  spots,
  initialCenter,
  canAddSpot,
  onSpotsChange,
  onPhotoSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [is3D, setIs3D] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedCoord, setSelectedCoord] = useState<{ lng: number; lat: number } | null>(null);
  const [inputName, setInputName] = useState('');
  const [spotError, setSpotError] = useState('');
  const [, startSpotTransition] = useTransition();

  const [localSpots, setLocalSpots] = useState<LocalSpot[]>(spots);

  const [activeSpot, setActiveSpot] = useState<LocalSpot | null>(null);

  // stale closure 방지: useEffect([], []) 클로저 안에서 isAddMode 최신값 읽기용
  const addModeRef = useRef(false);
  useEffect(() => { addModeRef.current = isAddMode; }, [isAddMode]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // 지도 초기화 (마운트 1회) — 마커 렌더링 제외
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
      zoom: 13,
      pitch: 60,
    });

    map.on('style.load', () => {
      map.setConfigProperty('basemap', 'lightPreset', 'dusk');
    });

    // 지도 클릭 핸들러 — addModeRef로 최신 isAddMode 읽음 (stale closure 방지)
    map.on('click', (e) => {
      if (!addModeRef.current) return;
      const { lng, lat } = e.lngLat;
      setSelectedCoord({ lng, lat });

      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: false })
        .setLngLat([lng, lat])
        .setHTML(`<p style="font-size:12px;margin:0;color:#1e293b">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>`)
        .addTo(map);
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 마커 렌더링: localSpots 변경 시 전체 재렌더
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      localSpots.forEach((spot, i) => {
        const color = getSpotColor(i, localSpots.length);

        const el = document.createElement('div');
        el.textContent = String(i + 1);
        Object.assign(el.style, {
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: color,
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

        el.addEventListener('click', () => {
          setActiveSpot((prev) => (prev?.id === spot.id ? null : spot));
        });
      });
    };

    if (map.loaded()) render();
    else map.once('load', render);
  }, [localSpots]);

  // pitch 토글
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({ pitch: is3D ? 60 : 0, duration: 1000 });
  }, [is3D]);

  // 폴리라인: localSpots 변경 시 Directions API 호출
  useEffect(() => {
    if (!mapRef.current || localSpots.length < 2 || !token) return;
    const map = mapRef.current;
    let cancelled = false;

    const drawRoute = (geometry: GeoJSON.Geometry) => {
      if (cancelled) return;
      const data = { type: 'Feature' as const, geometry, properties: {} };
      const existing = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
      } else {
        map.addSource('route', { type: 'geojson', data });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#fb923c',
            'line-width': 4,
            'line-opacity': 0.85,
            'line-emissive-strength': 1.0,
          },
        });
      }
    };

    const fetchAndDrawRoute = async () => {
      const coords = localSpots.map(s => `${s.lng},${s.lat}`).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;
      try {
        const res = await fetch(url);
        if (cancelled) return;
        if (!res.ok) throw new Error('Directions API 실패');
        const data = await res.json();
        if (cancelled) return;
        if (!data.routes || data.routes.length === 0) {
          console.warn('폴리라인: 경로를 찾지 못함');
          return;
        }
        drawRoute(data.routes[0].geometry);
      } catch (err) {
        if (cancelled) return;
        console.error('폴리라인 오류:', err);
      }
    };

    if (map.loaded()) {
      fetchAndDrawRoute();
    } else {
      map.once('load', () => fetchAndDrawRoute());
    }

    return () => {
      cancelled = true;
    };
  }, [localSpots, token]);

  function handleReorder(newSpots: LocalSpot[]) {
    setLocalSpots(newSpots);
    onSpotsChange?.(newSpots);
  }

  function handleSpotUpdate(fields: { name?: string; review?: string; photoUrl?: string | null }) {
    setActiveSpot((prev) => (prev ? { ...prev, ...fields } : null));
    const next = localSpots.map((s) =>
      s.id === activeSpot?.id ? { ...s, ...fields } : s
    );
    setLocalSpots(next);
    onSpotsChange?.(next);
  }

  function handleDelete(spotId: string) {
    const next = localSpots
      .filter((s) => s.id !== spotId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setLocalSpots(next);
    setActiveSpot(null);
    onSpotsChange?.(next);
  }

  function exitAddMode() {
    setIsAddMode(false);
    setSelectedCoord(null);
    setInputName('');
    setSpotError('');
    popupRef.current?.remove();
    popupRef.current = null;
  }

  function handleSaveSpot() {
    if (!selectedCoord || !inputName.trim()) return;
    startSpotTransition(() => {
      const newSpot: LocalSpot = {
        id: `tmp_${crypto.randomUUID()}`,
        name: inputName.trim(),
        lat: selectedCoord.lat,
        lng: selectedCoord.lng,
        order: localSpots.length + 1,
      };
      const next = [...localSpots, newSpot];
      setLocalSpots(next);
      onSpotsChange?.(next);
      exitAddMode();
    });
  }

  if (!token) {
    return (
      <div className="w-full h-[400px] rounded-xl bg-slate-100 flex items-center justify-center text-sm text-slate-500">
        지도를 표시하려면 Mapbox 토큰이 필요합니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col md:flex-row gap-3">
        {/* 사이드 카드 — 항상 DOM에 존재, transition으로 show/hide */}
<div className={`overflow-hidden flex-shrink-0 transition-all duration-200 ${
          activeSpot ? 'w-full md:w-2/5 opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}>
          {activeSpot && (
            <div className="bg-white rounded-xl shadow-lg h-full overflow-y-auto border border-slate-200">
              <SpotPopup
                key={activeSpot.id}
                spot={activeSpot}
                readOnly={!canAddSpot}
                onDelete={canAddSpot ? () => handleDelete(activeSpot.id) : undefined}
                onClose={() => setActiveSpot(null)}
                onUpdate={handleSpotUpdate}
                onFileSelect={(file) => onPhotoSelect?.(activeSpot.id, file)}
              />
            </div>
          )}
        </div>

        {/* 지도 컨테이너 */}
        <div className="relative flex-1 h-[400px] md:h-[500px] rounded-xl overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />
          {/* 버튼 스택 (우측 상단) */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
            {canAddSpot && (
              <button
                type="button"
                onClick={() => (isAddMode ? exitAddMode() : setIsAddMode(true))}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg shadow-md transition-colors ${
                  isAddMode
                    ? 'bg-sky-500 text-white hover:bg-sky-600'
                    : 'bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-white'
                }`}
              >
                {isAddMode ? '완료' : '마커 추가'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIs3D((prev) => !prev)}
              className="bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow-md hover:bg-white transition-colors"
            >
              {is3D ? '2D' : '3D'}
            </button>
          </div>
        </div>
      </div>

      {/* 마커 목록: 편집 모드에서 항상 표시 */}
      {canAddSpot && localSpots.length > 0 && (
        <SpotList spots={localSpots} onReorder={handleReorder} />
      )}
      {spotError && <p className="text-xs text-red-600">{spotError}</p>}

      {/* 인라인 폼: isAddMode + selectedCoord 시 표시 */}
      {isAddMode && selectedCoord && (
        <div className="bg-white/90 backdrop-blur-sm border border-black/10 rounded-xl px-4 py-3 flex flex-col gap-2 shadow-sm">
          <p className="text-xs text-slate-500">
            위도 {selectedCoord.lat.toFixed(5)}, 경도 {selectedCoord.lng.toFixed(5)}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveSpot(); } }}
              placeholder="장소 이름 (예: 후암동 오리올)"
              className="flex-1 border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
            />
            <button
              type="button"
              onClick={handleSaveSpot}
              disabled={!inputName.trim()}
              className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              저장
            </button>
            <button
              type="button"
              onClick={exitAddMode}
              className="px-4 py-2 rounded-[10px] text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
          </div>
          {spotError && (
            <p className="text-xs text-red-600">{spotError}</p>
          )}
        </div>
      )}
    </div>
  );
}
