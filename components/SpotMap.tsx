'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useKakaoLoader, Map, CustomOverlayMap, Polyline } from 'react-kakao-maps-sdk';
import type { LocalSpot } from '@/lib/types';
import { SpotList } from './SpotList';
import { SpotPopup } from './SpotPopup';
import { getSpotColor } from '@/lib/spot-color';
import { Search, MapPin, ArrowUpDown, ArrowLeft, Lightbulb } from 'lucide-react';

const LONG_DISTANCE_KM = 50;
const MERGE_EPSILON_KM = 0.05; // 50m 이내 = 같은 장소로 병합

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type MarkerGroup = {
  representative: LocalSpot;
  orders: number[];
};

function groupByProximity(spots: LocalSpot[]): MarkerGroup[] {
  const groups: MarkerGroup[] = [];
  for (const spot of spots) {
    const hit = groups.find(g => haversineKm(g.representative, spot) < MERGE_EPSILON_KM);
    if (hit) {
      hit.orders.push(spot.order);
    } else {
      groups.push({ representative: spot, orders: [spot.order] });
    }
  }
  groups.forEach(g => g.orders.sort((a, b) => a - b));
  return groups;
}

type Mode = 'menu' | 'pinning' | 'search' | 'reorder' | 'edit' | 'view';

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

  const modeRef = useRef<Mode>('menu');
  const addSpotFromMapRef = useRef<((lng: number, lat: number) => void) | null>(null);
  const fitDoneRef = useRef(false);

  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null);
  const [localSpots, setLocalSpots] = useState<LocalSpot[]>(spots);
  const [activeSpot, setActiveSpot] = useState<LocalSpot | null>(null);
  const [displayedSpot, setDisplayedSpot] = useState<LocalSpot | null>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<kakao.maps.services.PlacesSearchResultItem[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'ok' | 'zero' | 'error'>('idle');

  // modeRef·addSpotFromMapRef를 렌더마다 최신값으로 갱신 (stale closure 방지)
  modeRef.current = mode;
  addSpotFromMapRef.current = (lng: number, lat: number) => {
    const id = addSpot('', lng, lat);
    setActiveSpot({ id, name: '', lat, lng, order: localSpots.length + 1 });
    setMode('edit');
  };

  // initialCenter props: [lng, lat] 순서 → 카카오 {lat, lng}로 변환 ★★★
  const [mapCenter, setMapCenter] = useState(() =>
    spots.length > 0
      ? { lat: spots[0].lat, lng: spots[0].lng }
      : initialCenter
        ? { lat: initialCenter[1], lng: initialCenter[0] }
        : { lat: 37.566, lng: 126.978 }
  );
  const [mapLevel, setMapLevel] = useState(5);

  function handleMapCreate(map: kakao.maps.Map) {
    setMapInstance(map); // re-render 트리거 → SpotMap useEffect가 Map 내부 effect 이후 실행
  }

  // setBounds를 useEffect로 이관: 자식(Map) effect → 부모(SpotMap) effect 순서 보장
  // Map 내부 center/level 동기화 이후에 setBounds가 실행되므로 덮어씌워지지 않음
  useEffect(() => {
    if (!mapInstance || fitDoneRef.current || spots.length < 2) return;
    const bounds = new kakao.maps.LatLngBounds();
    spots.forEach(s => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng))); // ★★★ lat first
    mapInstance.setBounds(bounds, 60, 60, 60, 60);
    fitDoneRef.current = true;
  }, [mapInstance]);

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
      setMapCenter({ lat: spot.lat, lng: spot.lng });
    }
    setMode('view');
    triggerPulse(spot.id);
  }

  function handleSpotSelect(spot: LocalSpot) {
    setDisplayedSpot(spot);
    setActiveSpot(spot);
    setMode('view');
    setMapCenter({ lat: spot.lat, lng: spot.lng });
    triggerPulse(spot.id);
  }

  function handleSpotUpdate(fields: { name?: string; review?: string; photoUrl?: string | null; movieId?: string | null; movieTitle?: string | null; nearestStation?: string | null; transitMinutes?: number | null }) {
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
    const reindexed = newSpots.map((s, i) => ({ ...s, order: i + 1 }));
    setLocalSpots(reindexed);
    onSpotsChange?.(reindexed);
  }

  function handleKeywordSearch() {
    const kw = searchKeyword.trim();
    if (!kw) return;
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(kw, (data, status) => {
      if (status === kakao.maps.services.Status.OK) {
        setSearchResults(data);
        setSearchStatus('ok');
      } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
        setSearchResults([]);
        setSearchStatus('zero');
      } else {
        setSearchResults([]);
        setSearchStatus('error');
      }
    });
  }

  function handlePlaceSelect(place: kakao.maps.services.PlacesSearchResultItem) {
    const lng = parseFloat(place.x); // x = 경도(lng) ★★★
    const lat = parseFloat(place.y); // y = 위도(lat) ★★★
    const id = addSpot(place.place_name, lng, lat);
    setActiveSpot({ id, name: place.place_name, lat, lng, order: localSpots.length + 1 });
    setMode('edit');
    // @ts-expect-error kakao.maps.d.ts 커뮤니티 타입에 jump 누락 (공식 API)
    mapInstance?.jump(new kakao.maps.LatLng(lat, lng), 3);
    setMapCenter({ lat, lng });
    setMapLevel(3);
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
        <div className={`overflow-hidden flex-shrink-0 transition-all duration-200 ${(canAddSpot || activeSpot || readOnly) ? 'w-full md:w-2/5 opacity-100' : 'w-0 opacity-0 pointer-events-none'
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
              ) : mode === 'search' ? (
                <>
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Search size={40} className="text-slate-300" />
                    <p className="text-sm text-slate-400 text-center">오른쪽 지도에서 장소를 검색하세요</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMode('menu'); setSearchKeyword(''); setSearchResults([]); setSearchStatus('idle'); }}
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
                      onDragStart={(spot) => setMapCenter({ lat: spot.lat, lng: spot.lng })}
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
                      onClick={() => { setSearchKeyword(''); setSearchResults([]); setSearchStatus('idle'); setMode('search'); }}
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
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left w-full transition-colors ${localSpots.length >= 2
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
            center={mapCenter}
            level={mapLevel}
            isPanto={true}
            onCreate={handleMapCreate}
            onClick={handleMapClick}
            className="w-full h-full"
          >
            {/* 폴리라인: 단거리 2겹 실선 / 장거리(50km↑) 1겹 점선 */}
            {localSpots.length >= 2 && localSpots.slice(0, -1).map((spot, i) => {
              const next = localSpots[i + 1];
              const isDash = haversineKm(spot, next) > LONG_DISTANCE_KM;
              const path = [
                { lat: spot.lat, lng: spot.lng },
                { lat: next.lat, lng: next.lng },
              ];
              return (
                <Fragment key={spot.id}>
                  {isDash ? (
                    <Polyline
                      path={path}
                      strokeWeight={3}
                      strokeColor="#1a8cff"
                      strokeOpacity={0.7}
                      strokeStyle="dash"
                      zIndex={1}
                    />
                  ) : (
                    <>
                      <Polyline path={path} strokeWeight={10} strokeColor="#0a5cc4" strokeOpacity={1} strokeStyle="solid" zIndex={1} />
                      <Polyline path={path} strokeWeight={6}  strokeColor="#1a8cff" strokeOpacity={1} strokeStyle="solid" zIndex={2} />
                    </>
                  )}
                </Fragment>
              );
            })}

            {/* 마커: CustomOverlayMap + 펄스. 같은 좌표(50m 이내) 병합 → "1·7" 라벨 */}
            {groupByProximity(localSpots).map((group) => {
              const isMerge = group.orders.length > 1;
              const label = group.orders.join('·');
              const firstColor = getSpotColor(group.orders[0] - 1, localSpots.length);
              const lastColor  = getSpotColor(group.orders[group.orders.length - 1] - 1, localSpots.length);
              const background = isMerge
                ? `linear-gradient(135deg, ${firstColor}, ${lastColor})`
                : firstColor;
              const isPulse = group.orders.some(o =>
                localSpots.find(s => s.order === o && pulsingIds.has(s.id))
              );
              return (
                <CustomOverlayMap
                  key={group.representative.id}
                  position={{ lat: group.representative.lat, lng: group.representative.lng }}  // ★★★ lat first
                  zIndex={1}
                >
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <div
                      onClick={() => handleMarkerClick(group.representative)}
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        borderRadius: 9999,
                        background: background,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isMerge ? 11 : 12,
                        fontWeight: 'bold',
                        border: '2px solid #fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        cursor: 'default',
                        minWidth: 28,
                        height: 28,
                        padding: isMerge ? '0 6px' : 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </div>
                    {isPulse && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: -5,
                          borderRadius: 9999,
                          background: `linear-gradient(135deg, ${firstColor}, ${lastColor})`,
                          zIndex: 0,
                          animation: 'spot-pulse 0.6s ease-out forwards',
                          pointerEvents: 'none',
                        }}
                        onAnimationEnd={() => {
                          group.orders.forEach(o => {
                            const s = localSpots.find(sp => sp.order === o);
                            if (s) setPulsingIds(prev => { const ns = new Set(prev); ns.delete(s.id); return ns; });
                          });
                        }}
                      />
                    )}
                  </div>
                </CustomOverlayMap>
              );
            })}
          </Map>
          {mode === 'search' && (
            <div className="absolute inset-x-3 top-3 z-20">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Search size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleKeywordSearch(); }}
                    placeholder="예) 광화문, 서울시청"
                    autoFocus
                    className="flex-1 text-sm text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleKeywordSearch}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 transition-colors"
                  >
                    검색
                  </button>
                </div>
                {searchStatus === 'zero' && (
                  <div className="border-t border-slate-100 px-3 py-3">
                    <p className="text-sm text-slate-400">검색 결과가 없습니다.</p>
                  </div>
                )}
                {searchStatus === 'error' && (
                  <div className="border-t border-slate-100 px-3 py-3">
                    <p className="text-sm text-red-400">검색 중 오류가 발생했습니다.</p>
                  </div>
                )}
                {searchStatus === 'ok' && (
                  <div className="border-t border-slate-100 max-h-48 overflow-y-auto">
                    {searchResults.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => handlePlaceSelect(place)}
                        className="text-left w-full px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                      >
                        <p className="text-sm font-medium text-slate-700">{place.place_name}</p>
                        <p className="text-xs text-slate-400">{place.address_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
