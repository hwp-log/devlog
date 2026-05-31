'use client';

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { LocalSpot } from '@/lib/types';
import { SpotList } from './SpotList';
import { SpotPopup } from './SpotPopup';
import { getSpotColor } from '@/lib/spot-color';
import { Search, MapPin, ArrowUpDown, ArrowLeft, Lightbulb } from 'lucide-react';

type Mode = 'menu' | 'pinning' | 'search' | 'reorder' | 'edit' | 'view';

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
  readOnly?: boolean;
};

export default function SpotMap({
  spots,
  initialCenter,
  canAddSpot,
  onSpotsChange,
  onPhotoSelect,
  readOnly,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const markerElemsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const [is3D, setIs3D] = useState(false);

  const [localSpots, setLocalSpots] = useState<LocalSpot[]>(spots);

  const [activeSpot, setActiveSpot] = useState<LocalSpot | null>(null);
  const [displayedSpot, setDisplayedSpot] = useState<LocalSpot | null>(null);
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
      markerElemsRef.current.clear();

      localSpots.forEach((spot, i) => {
        const color = getSpotColor(i, localSpots.length);

        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
          position: 'relative',
          width: '28px',
          height: '28px',
        });

        const el = document.createElement('div');
        el.textContent = String(i + 1);
        Object.assign(el.style, {
          position: 'absolute',
          inset: '0',
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
        wrapper.appendChild(el);
        markerElemsRef.current.set(spot.id, wrapper);

        const marker = new mapboxgl.Marker({ element: wrapper })
          .setLngLat([spot.lng, spot.lat])
          .addTo(map);
        markersRef.current.push(marker);

        el.addEventListener('click', () => {
          setActiveSpot((prev) => (prev?.id === spot.id ? null : spot));
          if (readOnly) {
            setDisplayedSpot(spot);
            mapRef.current?.panTo([spot.lng, spot.lat]);
          }
          setMode('view');
          const ring = document.createElement('div');
          Object.assign(ring.style, {
            position: 'absolute',
            inset: '-5px',
            borderRadius: '50%',
            border: `2px solid ${color}`,
            animation: 'spot-pulse 0.6s ease-out forwards',
            pointerEvents: 'none',
          });
          wrapper.appendChild(ring);
          ring.addEventListener('animationend', () => ring.remove());
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

  function triggerPulse(spotId: string) {
    const wrapper = markerElemsRef.current.get(spotId);
    if (!wrapper) return;
    const idx = localSpots.findIndex((s) => s.id === spotId);
    const color = idx >= 0 ? getSpotColor(idx, localSpots.length) : '#0ea5e9';
    const ring = document.createElement('div');
    Object.assign(ring.style, {
      position: 'absolute',
      inset: '-5px',
      borderRadius: '50%',
      border: `2px solid ${color}`,
      animation: 'spot-pulse 0.6s ease-out forwards',
      pointerEvents: 'none',
    });
    wrapper.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
  }

  function handleSpotSelect(spot: LocalSpot) {
    setDisplayedSpot(spot);
    setActiveSpot(spot);
    setMode('view');
    mapRef.current?.panTo([spot.lng, spot.lat]);
    triggerPulse(spot.id);
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

  function handleDeleteInReorder(spotId: string) {
    handleDelete(spotId);
    if (localSpots.filter((s) => s.id !== spotId).length < 2) {
      setMode('menu');
    }
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
          (canAddSpot || activeSpot || readOnly) ? 'w-full md:w-2/5 opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}>
          {readOnly ? (
            <div className="bg-white rounded-xl shadow-lg h-full border border-slate-200 p-5 relative overflow-hidden">
              {/* 리스트 */}
              <div className={`transition-opacity duration-200 flex flex-col h-full ${activeSpot ? 'opacity-0 pointer-events-none absolute inset-0 p-5' : 'opacity-100'}`}>
                <p className="text-base font-semibold text-slate-800 mb-3">순서</p>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <SpotList readOnly spots={localSpots} onSelect={handleSpotSelect} />
                </div>
              </div>
              {/* 카드 */}
              <div className={`absolute inset-0 transition-opacity duration-200 overflow-y-auto ${activeSpot ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {displayedSpot && (
                  <SpotPopup
                    key={displayedSpot.id}
                    spot={displayedSpot}
                    readOnly
                    onClose={() => { setActiveSpot(null); setMode('menu'); }}
                  />
                )}
              </div>
            </div>
          ) : activeSpot ? (
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
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <MapPin size={40} className="text-slate-300" />
                    <p className="text-sm text-slate-400 text-center">지도를 클릭해 위치를 지정하세요</p>
                  </div>
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
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Search size={40} className="text-slate-300" />
                    <p className="text-sm text-slate-400 text-center">오른쪽 지도에서 검색 결과를 선택하세요</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('menu')}
                    className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg w-fit transition-colors"
                  >
                    <ArrowLeft size={14} />
                    뒤로
                  </button>
                </>
              ) : mode === 'reorder' ? (
                <>
                  <p className="text-base font-semibold text-slate-800">여행순서 바꾸기</p>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <SpotList
                      spots={localSpots}
                      onReorder={handleReorder}
                      onDelete={handleDeleteInReorder}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <Lightbulb size={12} className="text-slate-300 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-400">⠿ 을 누르고 위아래로 옮기면 순서를 바꿀 수 있습니다.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lightbulb size={12} className="text-slate-300 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-400">마커를 지우려면 × 를 누르세요.</p>
                    </div>
                  </div>
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
                  <p className="text-base font-semibold text-slate-800">나만의 경로 짜기</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('search')}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 text-left w-full hover:bg-slate-50 transition-colors"
                    >
                      <Search size={20} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">촬영지 직접검색</p>
                        <p className="text-xs text-slate-500">이름으로 바로 추가</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('pinning')}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 text-left w-full hover:bg-slate-50 transition-colors"
                    >
                      <MapPin size={20} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">지도에서 찍기</p>
                        <p className="text-xs text-slate-500">지도를 눌러 위치 지정</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('reorder')}
                      disabled={localSpots.length < 2}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left w-full transition-colors ${
                        localSpots.length >= 2
                          ? 'border-slate-200 hover:bg-slate-50'
                          : 'border-slate-200 opacity-40 cursor-not-allowed bg-slate-50'
                      }`}
                    >
                      <ArrowUpDown size={20} className={`shrink-0 ${localSpots.length >= 2 ? 'text-slate-400' : 'text-slate-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-700">여행순서 바꾸기</p>
                        <p className="text-xs text-slate-500">방문 순서 편집</p>
                      </div>
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600">나만의 여행 동선 만들기</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 mt-0.5 shrink-0 font-medium">①</span>
                        <p className="text-xs text-slate-500">촬영지 직접검색 또는 지도에서 찍기 버튼을 눌러 마커를 하나 추가합니다.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 mt-0.5 shrink-0 font-medium">②</span>
                        <p className="text-xs text-slate-500">추가한 마커의 장소에 사진과 리뷰를 작성합니다.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 mt-0.5 shrink-0 font-medium">③</span>
                        <p className="text-xs text-slate-500">1,2를 반복하면 마커가 선으로 이어져 나만의 여행 동선이 완성됩니다.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lightbulb size={12} className="text-slate-300 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-400">마커 순서를 바꾸려면 여행순서 바꾸기 버튼을 누르면 됩니다.</p>
                    </div>
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
                placeholder="예) 광화문, 서울시청"
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
    </div>
  );
}
