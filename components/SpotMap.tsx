'use client';

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { LocalSpot } from '@/lib/types';
import { SpotList } from './SpotList';
import { SpotPopup } from './SpotPopup';
import { getSpotColor } from '@/lib/spot-color';
import { Search, MapPin, ArrowUpDown, ArrowLeft } from 'lucide-react';

type Mode = 'menu' | 'pinning' | 'search' | 'edit' | 'view';

const SearchBoxDynamic = dynamic(
  () => import('@mapbox/search-js-react').then((m) => ({ default: m.SearchBox })),
  { ssr: false }
);

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

  const [is3D, setIs3D] = useState(false);

  const [localSpots, setLocalSpots] = useState<LocalSpot[]>(spots);

  const [activeSpot, setActiveSpot] = useState<LocalSpot | null>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [searchedName, setSearchedName] = useState('');

  // stale closure 방지: useEffect([], []) 클로저 안에서 mode 최신값 읽기용
  const modeRef = useRef<Mode>('menu');
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // 콜백 ref: 렌더마다 최신 addSpot·localSpots·setActiveSpot을 캡처 (stale closure 우회)
  const addSpotFromMapRef = useRef<((lng: number, lat: number) => void) | null>(null);

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

    // 지도 클릭 핸들러 — modeRef·addSpotFromMapRef로 최신값 읽음 (stale closure 방지)
    map.on('click', (e) => {
      if (modeRef.current !== 'pinning') return;
      const { lng, lat } = e.lngLat;
      addSpotFromMapRef.current?.(lng, lat);
    });

    mapRef.current = map;

    return () => {
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
          setMode('view');
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
    if (!mapRef.current || !token) return;
    const map = mapRef.current;

    if (localSpots.length < 2) {
      if (map.loaded()) {
        if (map.getLayer('route-line')) map.removeLayer('route-line');
        if (map.getSource('route')) map.removeSource('route');
      }
      return;
    }
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

  function addSpot(name: string, lng: number, lat: number): string {
    const id = `tmp_${crypto.randomUUID()}`;
    const newSpot: LocalSpot = {
      id,
      name,
      lat,
      lng,
      order: localSpots.length + 1,
    };
    const next = [...localSpots, newSpot];
    setLocalSpots(next);
    onSpotsChange?.(next);
    return id;
  }

  // deps 없는 effect → 렌더 후마다 최신 addSpot·localSpots를 ref에 반영
  useEffect(() => {
    addSpotFromMapRef.current = (lng: number, lat: number) => {
      const id = addSpot('', lng, lat);
      setActiveSpot({ id, name: '', lat, lng, order: localSpots.length + 1 });
      setSearchedName('');
      setMode('edit');
    };
  });

  function handleSearchRetrieve(res: import('@mapbox/search-js-core').SearchBoxRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    const name = (feature.properties.name ?? '') as string;
    const id = addSpot('', lng, lat);
    setActiveSpot({ id, name: '', lat, lng, order: localSpots.length + 1 });
    setSearchedName(name);
    setMode('edit');
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
          (canAddSpot || activeSpot) ? 'w-full md:w-2/5 opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}>
          {activeSpot ? (
            <div className="bg-white rounded-xl shadow-lg h-full overflow-y-auto border border-slate-200">
              <SpotPopup
                key={activeSpot.id}
                spot={activeSpot}
                readOnly={!canAddSpot}
                onDelete={canAddSpot ? () => handleDelete(activeSpot.id) : undefined}
                onClose={() => { setActiveSpot(null); setMode('menu'); }}
                onUpdate={handleSpotUpdate}
                onFileSelect={(file) => onPhotoSelect?.(activeSpot.id, file)}
                initialEditing={mode === 'edit'}
                initialNameInput={searchedName || undefined}
              />
            </div>
          ) : canAddSpot ? (
            <div className="bg-white rounded-xl shadow-lg h-full border border-slate-200 p-5 flex flex-col gap-4">
              {mode === 'pinning' ? (
                <>
                  <p className="text-sm text-slate-500">지도를 클릭하세요</p>
                  <button
                    type="button"
                    onClick={() => setMode('menu')}
                    className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg w-fit transition-colors"
                  >
                    <ArrowLeft size={14} />
                    뒤로
                  </button>
                </>
              ) : mode === 'search' ? (
                <>
                  <p className="text-sm text-slate-500">장소 이름으로 검색하세요</p>
                  <button
                    type="button"
                    onClick={() => setMode('menu')}
                    className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg w-fit transition-colors"
                  >
                    <ArrowLeft size={14} />
                    뒤로
                  </button>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-slate-800">여행동선 짜기</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('search')}
                      className="flex items-center gap-3 p-3 rounded-lg border border-sky-200 text-left w-full hover:bg-sky-50 transition-colors"
                    >
                      <Search size={20} className="text-sky-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">촬영지 직접검색</p>
                        <p className="text-xs text-slate-500">이름으로 바로 추가</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('pinning')}
                      className="flex items-center gap-3 p-3 rounded-lg border border-sky-200 text-left w-full hover:bg-sky-50 transition-colors"
                    >
                      <MapPin size={20} className="text-sky-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">지도에서 찍기</p>
                        <p className="text-xs text-slate-500">지도를 눌러 위치 지정</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 text-left w-full opacity-40 cursor-not-allowed bg-slate-50"
                    >
                      <ArrowUpDown size={20} className="text-slate-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">여행순서 바꾸기</p>
                        <p className="text-xs text-slate-500">방문 순서 편집</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* 지도 컨테이너 */}
        <div className="relative flex-1 h-[400px] md:h-[500px] rounded-xl overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />
          {mode === 'search' && token && (
            <div className="absolute inset-x-3 top-3 z-20">
              <SearchBoxDynamic
                accessToken={token}
                map={mapRef.current ?? undefined}
                mapboxgl={mapboxgl}
                options={{ language: 'ko', country: 'kr' }}
                onRetrieve={handleSearchRetrieve}
                marker={false}
              />
            </div>
          )}
          {/* 버튼 스택 (우측 상단) */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
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
    </div>
  );
}
