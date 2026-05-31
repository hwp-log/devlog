'use client';

import { useRef, useState } from 'react';
import { useKakaoLoader, Map, CustomOverlayMap, Polyline } from 'react-kakao-maps-sdk';
import type { LocalSpot } from '@/lib/types';
import { SpotList } from './SpotList';
import { SpotPopup } from './SpotPopup';
import { getSpotColor } from '@/lib/spot-color';
import { Search, MapPin, ArrowUpDown, ArrowLeft, Lightbulb } from 'lucide-react';

type Mode = 'menu' | 'pinning' | 'reorder' | 'edit' | 'view';

type Props = {
  spots: LocalSpot[];
  initialCenter?: [number, number]; // [lng, lat] — 기존 호출 측 인터페이스 유지
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
  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '',
    libraries: ['services'],
  });

  const mapRef = useRef<kakao.maps.Map | null>(null);
  const modeRef = useRef<Mode>('menu');
  const addSpotFromMapRef = useRef<((lng: number, lat: number) => void) | null>(null);

  const [localSpots, setLocalSpots] = useState<LocalSpot[]>(spots);
  const [activeSpot, setActiveSpot] = useState<LocalSpot | null>(null);
  const [displayedSpot, setDisplayedSpot] = useState<LocalSpot | null>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());

  // modeRef·addSpotFromMapRef를 렌더마다 최신값으로 갱신 (stale closure 방지)
  modeRef.current = mode;
  addSpotFromMapRef.current = (lng: number, lat: number) => {
    const id = addSpot('', lng, lat);
    setActiveSpot({ id, name: '', lat, lng, order: localSpots.length + 1 });
    setMode('edit');
  };

  // initialCenter props: [lng, lat] 순서 → 카카오 {lat, lng}로 변환 ★★★
  const center = spots.length > 0
    ? { lat: spots[0].lat, lng: spots[0].lng }
    : initialCenter
      ? { lat: initialCenter[1], lng: initialCenter[0] }
      : { lat: 37.566, lng: 126.978 };

  function handleMapCreate(map: kakao.maps.Map) {
    mapRef.current = map;
    if (readOnly && spots.length >= 2) {
      const bounds = new kakao.maps.LatLngBounds();
      spots.forEach(s => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng))); // ★★★ lat first
      map.setBounds(bounds, 60, 60, 60, 60);
    }
  }

  function handleMapClick(_: kakao.maps.Map, mouseEvent: kakao.maps.event.MouseEvent) {
    if (modeRef.current !== 'pinning') return;
    const lat = mouseEvent.latLng.getLat(); // ★★★
    const lng = mouseEvent.latLng.getLng(); // ★★★
    addSpotFromMapRef.current?.(lng, lat);
  }

  function triggerPulse(spotId: string) {
    setPulsingIds(prev => new Set(prev).add(spotId));
  }

  function handleMarkerClick(spot: LocalSpot) {
    setActiveSpot((prev) => (prev?.id === spot.id ? null : spot));
    if (readOnly) {
      setDisplayedSpot(spot);
      mapRef.current?.panTo(new kakao.maps.LatLng(spot.lat, spot.lng)); // ★★★ lat first
    }
    setMode('view');
    triggerPulse(spot.id);
  }

  function handleSpotSelect(spot: LocalSpot) {
    setDisplayedSpot(spot);
    setActiveSpot(spot);
    setMode('view');
    mapRef.current?.panTo(new kakao.maps.LatLng(spot.lat, spot.lng)); // ★★★ lat first
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

  function handleReorder(newSpots: LocalSpot[]) {
    setLocalSpots(newSpots);
    onSpotsChange?.(newSpots);
  }

  function addSpot(name: string, lng: number, lat: number): string {
    const id = `tmp_${crypto.randomUUID()}`;
    const newSpot: LocalSpot = { id, name, lat, lng, order: localSpots.length + 1 };
    const next = [...localSpots, newSpot];
    setLocalSpots(next);
    onSpotsChange?.(next);
    return id;
  }

  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!appkey) {
    return (
      <div className="w-full h-[400px] rounded-xl bg-slate-100 flex items-center justify-center text-sm text-slate-500">
        지도를 표시하려면 카카오 앱키가 필요합니다.
      </div>
    );
  }
  if (loading) return <div className="w-full h-[400px] rounded-xl bg-slate-100 animate-pulse" />;
  if (error) return (
    <div className="w-full h-[400px] rounded-xl bg-slate-100 flex items-center justify-center text-sm text-slate-500">
      지도 로드에 실패했습니다.
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col md:flex-row gap-3">
        {/* 사이드 카드 — 항상 DOM에 존재, transition으로 show/hide */}
        <div className={`overflow-hidden flex-shrink-0 transition-all duration-200 ${
          (canAddSpot || activeSpot || readOnly) ? 'w-full md:w-2/5 opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}>
          {readOnly ? (
            <div className="bg-white rounded-xl shadow-lg h-full border border-slate-200 p-5 relative overflow-hidden">
              <div className={`transition-opacity duration-200 flex flex-col h-full ${activeSpot ? 'opacity-0 pointer-events-none absolute inset-0 p-5' : 'opacity-100'}`}>
                <p className="text-base font-semibold text-slate-800 mb-3">순서</p>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <SpotList readOnly spots={localSpots} onSelect={handleSpotSelect} />
                </div>
              </div>
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
              ) : mode === 'reorder' ? (
                <>
                  <p className="text-base font-semibold text-slate-800">여행순서 바꾸기</p>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <SpotList spots={localSpots} onReorder={handleReorder} onDelete={handleDeleteInReorder} />
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
                    {/* 촬영지 검색 — 0063에서 카카오 장소검색으로 구현 예정, 현재 비활성 */}
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 text-left w-full opacity-40 cursor-not-allowed bg-slate-50"
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
          <Map
            center={center}
            level={4}
            onCreate={handleMapCreate}
            onClick={handleMapClick}
            className="w-full h-full"
          >
            {/* 폴리라인: 케이싱(흰 테두리) + 코어(주황) 2겹 */}
            {localSpots.length >= 2 && localSpots.slice(0, -1).map((spot, i) => (
              <Polyline
                key={`casing-${spot.id}`}
                path={[
                  { lat: spot.lat, lng: spot.lng },
                  { lat: localSpots[i + 1].lat, lng: localSpots[i + 1].lng },
                ]}
                strokeWeight={7}
                strokeColor="#ffffff"
                strokeOpacity={0.9}
                zIndex={1}
              />
            ))}
            {localSpots.length >= 2 && localSpots.slice(0, -1).map((spot, i) => (
              <Polyline
                key={`core-${spot.id}`}
                path={[
                  { lat: spot.lat, lng: spot.lng },
                  { lat: localSpots[i + 1].lat, lng: localSpots[i + 1].lng },
                ]}
                strokeWeight={4}
                strokeColor="#f97316"
                strokeOpacity={1}
                zIndex={2}
              />
            ))}

            {/* 구간 중점 방향 화살표 — Mercator 보정 각도, 마커 아래(zIndex=0) */}
            {localSpots.length >= 2 && localSpots.slice(0, -1).map((a, i) => {
              const b = localSpots[i + 1];
              const midLat = (a.lat + b.lat) / 2;
              const midLng = (a.lng + b.lng) / 2;
              // cos(midLat) 보정으로 Mercator 위도 왜곡 제거 ★★★
              const angle = Math.atan2(
                -(b.lat - a.lat),
                (b.lng - a.lng) * Math.cos(midLat * Math.PI / 180)
              ) * 180 / Math.PI;
              return (
                <CustomOverlayMap
                  key={`arrow-${a.id}`}
                  position={{ lat: midLat, lng: midLng }}
                  zIndex={0}
                >
                  <div style={{
                    pointerEvents: 'none',
                    color: '#f97316',
                    fontSize: 20,
                    fontWeight: 'bold',
                    lineHeight: 1,
                    transform: `rotate(${angle}deg)`,
                    textShadow: '0 0 2px #fff, 0 0 4px #fff',
                    userSelect: 'none',
                  }}>
                    ›
                  </div>
                </CustomOverlayMap>
              );
            })}

            {/* 마커: CustomOverlayMap + 펄스 */}
            {localSpots.map((spot, i) => {
              const color = getSpotColor(i, localSpots.length);
              return (
                <CustomOverlayMap
                  key={spot.id}
                  position={{ lat: spot.lat, lng: spot.lng }}  // ★★★ lat first
                  zIndex={1}
                >
                  <div style={{ position: 'relative', width: 28, height: 28 }}>
                    <div
                      onClick={() => handleMarkerClick(spot)}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 'bold',
                        border: '2px solid #fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        cursor: 'default',
                      }}
                    >
                      {i + 1}
                    </div>
                    {pulsingIds.has(spot.id) && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: -5,
                          borderRadius: '50%',
                          border: `2px solid ${color}`,
                          animation: 'spot-pulse 0.6s ease-out forwards',
                          pointerEvents: 'none',
                        }}
                        onAnimationEnd={() => setPulsingIds(prev => {
                          const s = new Set(prev);
                          s.delete(spot.id);
                          return s;
                        })}
                      />
                    )}
                  </div>
                </CustomOverlayMap>
              );
            })}
          </Map>
        </div>
      </div>
    </div>
  );
}
