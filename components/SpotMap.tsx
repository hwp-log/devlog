'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useNaverMapsLoader } from '@/lib/naver/useNaverMapsLoader';
import type { LocalSpot } from '@/lib/types';
import { SpotList } from './SpotList';
import { SpotPopup } from './SpotPopup';
import { getSpotColor } from '@/lib/spot-color';
import { findNearbySpots, type NearbySpot } from '@/lib/spot/nearby';
import { searchPlaces, type PlaceResult } from '@/lib/spot/searchPlaces';
import { Search, MapPin, ArrowUpDown, ArrowLeft, Lightbulb } from 'lucide-react';

const LONG_DISTANCE_KM = 50;
const MERGE_EPSILON_KM = 0.05; // 50m 이내 = 같은 장소로 병합

// 줌 매핑(카카오 level→네이버 zoom 근사, 실화면 보정 대상): 기본 level5≈13 / 검색·찍기 확대 level3≈16
const ZOOM_DEFAULT = 13;
const ZOOM_FOCUS = 16;

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

// 마커 HTML(번호 알약 + 펄스) — 구 CustomOverlayMap JSX와 시각 동일 재현.
// 바깥 래퍼 translate(-50%,-50%) + anchor(0,0) = 카카오 중앙 앵커 상응. isDark는 그림자만 분기.
// 펄스 애니메이션은 globals.css @keyframes spot-pulse(0.6s) 참조 — 제거 타이머(triggerPulse)와 페어.
function markerContent(opts: {
  label: string;
  isMerge: boolean;
  firstColor: string;
  lastColor: string;
  isPulse: boolean;
  isDark: boolean;
}): string {
  const { label, isMerge, firstColor, lastColor, isPulse, isDark } = opts;
  const background = isMerge ? `linear-gradient(135deg, ${firstColor}, ${lastColor})` : firstColor;
  const shadow = isDark ? '0 2px 6px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.3)';
  const pulse = isPulse
    ? `<div style="position:absolute;inset:-5px;border-radius:9999px;background:linear-gradient(135deg, ${firstColor}, ${lastColor});z-index:0;animation:spot-pulse 0.6s ease-out forwards;pointer-events:none"></div>`
    : '';
  return `<div style="transform:translate(-50%,-50%);position:relative;display:inline-flex">
    <div style="position:relative;z-index:1;border-radius:9999px;background:${background};color:#fff;display:flex;align-items:center;justify-content:center;font-size:${isMerge ? 11 : 12}px;font-weight:bold;border:2px solid #fff;box-shadow:${shadow};cursor:default;min-width:28px;height:28px;padding:${isMerge ? '0 6px' : '0'};white-space:nowrap">${label}</div>
    ${pulse}
  </div>`;
}

type Mode = 'menu' | 'pinning' | 'search' | 'reorder' | 'edit' | 'view';

// 글쓰기(fixedSideWidth) 사이드 카드 폭 — 실화면 비교용 단일 스위치.
// 현재 426 고정: 카드 426 / 지도 422(=860−426−12). ↔ 'w-full md:w-2/5': 카드 344 / 지도 504.
const WRITE_SIDE_CARD_WIDTH = 'w-full md:w-[426px]';

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
  // 글쓰기: 섹션 760 폭이라 비율(304)이 과협소 → WRITE_SIDE_CARD_WIDTH 적용. 상세(readOnly)는 미전달=비율 2/5.
  fixedSideWidth?: boolean;
};

export default function SpotMap({
  spots,
  initialCenter,
  canAddSpot,
  onSpotsChange,
  onPhotoSelect,
  readOnly,
  fixedSideWidth,
}: Props) {
  const { status, retry } = useNaverMapsLoader();
  const { resolvedTheme } = useTheme();
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null); // 테마 재생성 시 직전 뷰 보존
  const lastSizeRef = useRef({ w: 0, h: 0 }); // relayout 재-observe 즉발 콜백 가드

  const modeRef = useRef<Mode>('menu');
  const addSpotFromMapRef = useRef<((lng: number, lat: number) => void) | null>(null);
  const fitDoneRef = useRef(false);

  const [mapInstance, setMapInstance] = useState<naver.maps.Map | null>(null);
  const [localSpots, setLocalSpots] = useState<LocalSpot[]>(spots);
  const [activeSpot, setActiveSpot] = useState<LocalSpot | null>(null);
  const [displayedSpot, setDisplayedSpot] = useState<LocalSpot | null>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'ok' | 'zero' | 'error'>('idle');
  // S3-a: 마커 추가 시 근처 기존 촬영지 후보(있으면 재사용 선택 UI)
  const [nearbyChooser, setNearbyChooser] = useState<{ spotId: string; candidates: NearbySpot[] } | null>(null);

  // modeRef·addSpotFromMapRef를 렌더마다 최신값으로 갱신 (stale closure 방지)
  modeRef.current = mode;
  addSpotFromMapRef.current = async (lng: number, lat: number) => {
    const id = addSpot('', lng, lat);
    // S3-a: 근처 기존 촬영지 후보 조회 → 있으면 chooser(재사용/새등록 판단), 없으면 바로 편집
    const candidates = await findNearbySpots(lat, lng);
    if (candidates.length > 0) {
      setNearbyChooser({ spotId: id, candidates });
    } else {
      setActiveSpot({ id, name: '', lat, lng, order: localSpots.length + 1 });
      setMode('edit');
    }
  };

  // 초기 중심(생성 옵션 전용) — initialCenter props는 [lng, lat] 순서 유지(기존 호출 측 인터페이스) ★★★
  const [initialCtr] = useState(() =>
    spots.length > 0
      ? { lat: spots[0].lat, lng: spots[0].lng }
      : initialCenter
        ? { lat: initialCenter[1], lng: initialCenter[0] }
        : { lat: 37.566, lng: 126.978 }
  );

  // 부드러운 중심 이동 — 카카오 isPanto 상응
  function panTo(lat: number, lng: number) {
    mapInstance?.panTo(new naver.maps.LatLng(lat, lng));
  }

  // 지도 생성 — 명령형 init/destroy (StrictMode 이중 마운트 안전, GL 컨텍스트 해제).
  // 테마 전환 = 파괴·재생성: customStyleId 런타임 교체는 호출은 통과하나 미반영(SpotFinderMapNaver 0297 실측).
  // 첫 렌더 resolvedTheme=undefined 가드로 이중 init 차단. 파괴 직전 viewRef 캡처로 보던 뷰 재개.
  useEffect(() => {
    if (status !== 'ready' || !resolvedTheme || !mapDivRef.current) return;
    // WebGL 미지원(구형·차단·일부 헤드리스): 래스터 폴백 — 커스텀 스타일만 미적용, 기능 동일
    const supportsGl = !!document.createElement('canvas').getContext('webgl');
    // 타일 로드 전 SDK 기본 밝은 배경의 다크 깜빡임 방지 — 지도 div(테마 스코프 내부)에서 --card 실값 주입
    const mapBackground = getComputedStyle(mapDivRef.current).getPropertyValue('--card').trim();
    const view = viewRef.current;
    const map = new naver.maps.Map(mapDivRef.current, {
      center: new naver.maps.LatLng(view?.lat ?? initialCtr.lat, view?.lng ?? initialCtr.lng),
      zoom: view?.zoom ?? ZOOM_DEFAULT,
      background: mapBackground,
      // 커스텀 스타일(다크/라이트)은 GL(벡터) 전용. 라이트 env 미설정 시 SDK 기본 폴백(옵션 미전달)
      ...(supportsGl
        ? {
            gl: true,
            ...(resolvedTheme === 'dark'
              ? { customStyleId: process.env.NEXT_PUBLIC_NAVER_MAP_STYLE_ID }
              : process.env.NEXT_PUBLIC_NAVER_MAP_STYLE_ID_LIGHT
                ? { customStyleId: process.env.NEXT_PUBLIC_NAVER_MAP_STYLE_ID_LIGHT }
                : {}),
          }
        : {}),
    });
    // GL 지도는 비동기 초기화 — init 전 fitBounds는 빈 bounds 계산(SpotFinderMapNaver 실측). init 후 인스턴스 공개.
    const initListener = naver.maps.Event.once(map, 'init', () => setMapInstance(map));
    return () => {
      const c = map.getCenter() as naver.maps.LatLng;
      viewRef.current = { lat: c.lat(), lng: c.lng(), zoom: map.getZoom() };
      naver.maps.Event.removeListener(initListener); // 해제는 핸들 기반 — (target,type,fn)식은 조용히 누수
      setMapInstance(null);
      map.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 재생성 트리거는 로더·테마만(뷰는 viewRef 보존)
  }, [status, resolvedTheme]);

  // 초기 1회 전체 스팟 핏 — 카카오 setBounds(패딩 60) 상응. mapInstance는 init 후에만 세팅되므로 안전
  useEffect(() => {
    if (!mapInstance || fitDoneRef.current || spots.length < 2) return;
    const bounds = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(spots[0].lat, spots[0].lng),
      new naver.maps.LatLng(spots[0].lat, spots[0].lng),
    );
    spots.forEach(s => bounds.extend(new naver.maps.LatLng(s.lat, s.lng))); // ★★★ lat first
    mapInstance.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    fitDoneRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 마운트 스팟 기준 1회(fitDoneRef 가드)
  }, [mapInstance]);

  // 컨테이너 크기 변경 시 relayout — 0316 폭 버그(xl 1064 미채움) 해결. autoResize = 카카오 relayout() 상응.
  // 재-observe 즉발 콜백은 크기 불변 가드로 무시, rAF 배칭. 핏 재적합 미이식 — center 보존만 (SpotFinderMapNaver 축소판)
  useEffect(() => {
    const el = mapDivRef.current;
    if (!el || !mapInstance) return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      const { width, height } = el.getBoundingClientRect();
      if (width === lastSizeRef.current.w && height === lastSizeRef.current.h) return;
      lastSizeRef.current = { w: width, h: height };
      frame = requestAnimationFrame(() => {
        const center = mapInstance.getCenter();
        mapInstance.autoResize();
        mapInstance.setCenter(center);
      });
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mapInstance]);

  // 지도 클릭 → 좌표 찍기(핀 모드 전용) — modeRef/addSpotFromMapRef stale-closure 가드 그대로 사용.
  // e.coord는 LatLng 인스턴스(카카오 mouseEvent.latLng 상응)
  useEffect(() => {
    if (!mapInstance) return;
    const listener = naver.maps.Event.addListener(mapInstance, 'click', (e: naver.maps.PointerEvent) => {
      if (modeRef.current !== 'pinning') return;
      const coord = e.coord as naver.maps.LatLng;
      addSpotFromMapRef.current?.(coord.lng(), coord.lat()); // ★★★ (lng, lat) 인자 순서
    });
    return () => naver.maps.Event.removeListener(listener); // 해제는 핸들 기반
  }, [mapInstance]);

  // 마커 구축 — 스팟·펄스·테마 변경 시 파괴·재생성(스팟 수 소규모라 비용 무시 가능).
  // 같은 좌표(50m 이내) 병합 → "1·7" 라벨. 클릭은 마커 리스너(HTML 문자열엔 React 핸들러 불가).
  useEffect(() => {
    if (!mapInstance) return;
    const isDark = resolvedTheme === 'dark';
    const items = groupByProximity(localSpots).map((group) => {
      const isMerge = group.orders.length > 1;
      const label = group.orders.join('·');
      const firstColor = getSpotColor(group.orders[0] - 1, localSpots.length);
      const lastColor = getSpotColor(group.orders[group.orders.length - 1] - 1, localSpots.length);
      const isPulse = group.orders.some(o =>
        localSpots.find(s => s.order === o && pulsingIds.has(s.id))
      );
      const marker = new naver.maps.Marker({
        map: mapInstance,
        position: new naver.maps.LatLng(group.representative.lat, group.representative.lng), // ★★★ lat first
        icon: {
          content: markerContent({ label, isMerge, firstColor, lastColor, isPulse, isDark }),
          anchor: new naver.maps.Point(0, 0), // 콘텐츠 translate(-50%,-50%)와 페어 = 중앙 앵커
        },
        zIndex: 1,
      });
      const clickListener = naver.maps.Event.addListener(marker, 'click', () =>
        handleMarkerClick(group.representative)
      );
      return { marker, clickListener };
    });
    return () => {
      items.forEach(({ marker, clickListener }) => {
        naver.maps.Event.removeListener(clickListener); // 해제는 핸들 기반
        marker.setMap(null);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleMarkerClick은 안정 setter·prop만 사용(리빌드 트리거는 데이터·테마만)
  }, [mapInstance, localSpots, pulsingIds, resolvedTheme]);

  // 폴리라인 — 단거리 2겹 실선 / 장거리(50km↑) 1겹 점선 (구 <Polyline> 시각 동일)
  useEffect(() => {
    if (!mapInstance || localSpots.length < 2) return;
    const lines: naver.maps.Polyline[] = [];
    localSpots.slice(0, -1).forEach((spot, i) => {
      const next = localSpots[i + 1];
      const path = [new naver.maps.LatLng(spot.lat, spot.lng), new naver.maps.LatLng(next.lat, next.lng)];
      if (haversineKm(spot, next) > LONG_DISTANCE_KM) {
        lines.push(new naver.maps.Polyline({ map: mapInstance, path, strokeWeight: 3, strokeColor: '#1a8cff', strokeOpacity: 0.7, strokeStyle: 'dash', zIndex: 1 }));
      } else {
        lines.push(new naver.maps.Polyline({ map: mapInstance, path, strokeWeight: 10, strokeColor: '#0a5cc4', strokeOpacity: 1, strokeStyle: 'solid', zIndex: 1 }));
        lines.push(new naver.maps.Polyline({ map: mapInstance, path, strokeWeight: 6, strokeColor: '#1a8cff', strokeOpacity: 1, strokeStyle: 'solid', zIndex: 2 }));
      }
    });
    return () => lines.forEach(l => l.setMap(null));
  }, [mapInstance, localSpots]);

  function triggerPulse(spotId: string) {
    setPulsingIds(prev => new Set(prev).add(spotId));
    // globals.css @keyframes spot-pulse 0.6s와 페어 — HTML 문자열 마커라 onAnimationEnd 불가, 타이머로 제거
    window.setTimeout(() => {
      setPulsingIds(prev => { const ns = new Set(prev); ns.delete(spotId); return ns; });
    }, 600);
  }

  function handleMarkerClick(spot: LocalSpot) {
    setActiveSpot((prev) => (prev?.id === spot.id ? null : spot));
    if (readOnly) {
      setDisplayedSpot(spot);
      panTo(spot.lat, spot.lng);
    }
    setMode('view');
    triggerPulse(spot.id);
  }

  function handleSpotSelect(spot: LocalSpot) {
    setDisplayedSpot(spot);
    setActiveSpot(spot);
    setMode('view');
    panTo(spot.lat, spot.lng);
    triggerPulse(spot.id);
  }

  function handleSpotUpdate(fields: { name?: string; review?: string; photoUrl?: string | null; movieId?: string | null; movieTitle?: string | null; rating?: number | null }) {
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

  // 키워드 검색 — 서버 액션(lib/spot/searchPlaces, Kakao Local REST). 좌표 변환은 서버 완료.
  async function handleKeywordSearch() {
    const kw = searchKeyword.trim();
    if (!kw) return;
    const result = await searchPlaces(kw);
    if (result.status === 'ok') {
      setSearchResults(result.places);
      setSearchStatus('ok');
    } else {
      setSearchResults([]);
      setSearchStatus(result.status);
    }
  }

  async function handlePlaceSelect(place: PlaceResult) {
    const { lat, lng } = place; // x/y→lng/lat 변환은 서버 액션이 완료 — 클라엔 순수 숫자만
    const id = addSpot(place.name, lng, lat);
    // 중심·줌 원자 전환(카카오 jump 상응) — setZoom+setCenter는 0ms 점프라 기각(SpotFinderMapNaver 실측)
    mapInstance?.morph(new naver.maps.LatLng(lat, lng), ZOOM_FOCUS);
    // S3-a: 근처 기존 촬영지 후보 → chooser / 없으면 편집
    const candidates = await findNearbySpots(lat, lng);
    if (candidates.length > 0) {
      setNearbyChooser({ spotId: id, candidates });
    } else {
      setActiveSpot({ id, name: place.name, lat, lng, order: localSpots.length + 1 });
      setMode('edit');
    }
  }

  function addSpot(name: string, lng: number, lat: number): string {
    const id = `tmp_${crypto.randomUUID()}`;
    const newSpot: LocalSpot = { id, name, lat, lng, order: localSpots.length + 1 };
    const next = [...localSpots, newSpot];
    setLocalSpots(next);
    onSpotsChange?.(next);
    return id;
  }

  // S3-a: 근처 기존 스팟 선택 → 새 Spot 안 만들고 그 spotId 참조(reusedSpotId). 이름도 기존값으로.
  function chooseNearby(candidate: NearbySpot) {
    if (!nearbyChooser) return;
    const targetId = nearbyChooser.spotId;
    // 작품은 표시 전용으로 실음(0203 잠금 유지·저장 경로 무접촉). candidate.movies는 title 배열 → 대표+N만 표시.
    const next = localSpots.map((s) =>
      s.id === targetId
        ? {
            ...s,
            reusedSpotId: candidate.spotId,
            name: candidate.name,
            movieTitle: candidate.movies[0] ?? null,
            extraMovieCount: Math.max(0, candidate.movies.length - 1),
          }
        : s,
    );
    setLocalSpots(next);
    onSpotsChange?.(next);
    setActiveSpot(next.find((s) => s.id === targetId) ?? null);
    setMode('edit');
    setNearbyChooser(null);
  }
  // 새 장소로 등록 → 현행 신규 흐름(reusedSpotId 없음)
  function chooseNewPlace() {
    if (!nearbyChooser) return;
    setActiveSpot(localSpots.find((s) => s.id === nearbyChooser.spotId) ?? null);
    setMode('edit');
    setNearbyChooser(null);
  }

  if (!process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID) {
    return (
      <div className="w-full h-[400px] rounded-xl bg-card flex items-center justify-center text-sm text-muted">
        지도를 표시하려면 네이버 지도 클라이언트 ID가 필요합니다.
      </div>
    );
  }
  if (status === 'authError') {
    return (
      <div className="w-full h-[400px] rounded-xl bg-card flex items-center justify-center text-sm text-muted">
        지도 인증에 실패했습니다. (클라이언트 ID·도메인 등록 확인)
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="w-full h-[400px] rounded-xl bg-card flex flex-col items-center justify-center gap-2 text-sm text-muted">
        <p>지도 로드에 실패했습니다.</p>
        <button
          type="button"
          onClick={retry}
          className="text-xs text-fg2 bg-surface2 hover:bg-popover px-3 py-1.5 rounded-lg transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (status === 'loading') return <div className="w-full h-[400px] rounded-xl bg-card animate-pulse" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col md:flex-row gap-3">
        {/* 지도 컨테이너 */}
        <div className="relative flex-1 h-[400px] md:h-[500px] rounded-xl overflow-hidden">
          {/* 명령형 지도 마운트 지점 — 마커·폴리라인은 effect로 부착(② 단계), 선언형 자식 없음 */}
          <div ref={mapDivRef} className="w-full h-full" />
          {mode === 'search' && (
            <div className="absolute inset-x-3 top-3 z-20">
              <div className="bg-card rounded-xl shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Search size={14} className="text-muted shrink-0" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleKeywordSearch(); }}
                    placeholder="예) 광화문, 서울시청"
                    autoFocus
                    className="flex-1 text-sm text-fg focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleKeywordSearch}
                    className="text-xs text-muted hover:text-fg px-2 transition-colors"
                  >
                    검색
                  </button>
                </div>
                {searchStatus === 'zero' && (
                  <div className="border-t border-border px-3 py-3">
                    <p className="text-sm text-muted">검색 결과가 없습니다.</p>
                  </div>
                )}
                {searchStatus === 'error' && (
                  <div className="border-t border-border px-3 py-3">
                    <p className="text-sm text-red-400">검색 중 오류가 발생했습니다.</p>
                  </div>
                )}
                {searchStatus === 'ok' && (
                  <div className="border-t border-border max-h-48 overflow-y-auto">
                    {searchResults.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => handlePlaceSelect(place)}
                        className="text-left w-full px-3 py-2.5 hover:bg-surface2 transition-colors border-b border-border last:border-b-0"
                      >
                        <p className="text-sm font-medium text-fg">{place.name}</p>
                        <p className="text-xs text-muted">{place.address}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {/* 사이드 카드 — 항상 DOM에 존재, transition으로 show/hide.
            열림 폭: 글쓰기=WRITE_SIDE_CARD_WIDTH(426 고정) / 상세=비율 2/5. 두 값 모두 완전 리터럴(JIT 스캔) */}
        <div className={`overflow-hidden flex-shrink-0 transition-all duration-200 ${(canAddSpot || activeSpot || readOnly) ? `${fixedSideWidth ? WRITE_SIDE_CARD_WIDTH : 'w-full md:w-2/5'} opacity-100` : 'w-0 opacity-0 pointer-events-none'
          }`}>
          {readOnly ? (
            <div className="bg-card rounded-xl shadow-lg h-full border border-border p-5 relative overflow-hidden">
              <div className={`transition-opacity duration-200 flex flex-col h-full ${activeSpot ? 'opacity-0 pointer-events-none absolute inset-0 p-5' : 'opacity-100'}`}>
                <p className="text-base font-semibold text-fg mb-3">순서</p>
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
          ) : nearbyChooser ? (
            <div className="bg-card rounded-xl shadow-lg h-full overflow-y-auto border border-border p-5 flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-fg">근처에 이런 촬영지가 있어요</p>
                <p className="mt-0.5 text-xs text-muted">같은 곳이면 선택(중복 방지), 다르면 새 장소로 등록하세요.</p>
              </div>
              <ul className="flex flex-col gap-2">
                {nearbyChooser.candidates.map((c) => (
                  <li key={c.spotId}>
                    <button
                      type="button"
                      onClick={() => chooseNearby(c)}
                      className="w-full text-left rounded-lg border border-border hover:bg-surface2 px-3 py-2 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium text-fg truncate">{c.name}</span>
                        <span className="shrink-0 text-xs text-muted">{c.distanceM}m</span>
                      </div>
                      {c.movies.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.movies.map((m) => (
                            <span key={m} className="rounded-full bg-surface2 text-fg2 text-xs px-2 py-0.5">{m}</span>
                          ))}
                        </div>
                      )}
                      {c.storyCount > 0 && <p className="mt-1 text-xs text-muted">스토리 {c.storyCount}편</p>}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={chooseNewPlace}
                className="mt-1 w-full rounded-lg bg-primary text-white text-sm py-2 hover:bg-primary/90 transition-colors"
              >
                새 장소로 등록
              </button>
            </div>
          ) : activeSpot ? (
            <div className="bg-card rounded-xl shadow-lg h-full overflow-y-auto border border-border">
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
            <div className="bg-card rounded-xl shadow-lg h-full border border-border p-5 flex flex-col gap-4">
              {mode === 'pinning' ? (
                <>
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <MapPin size={40} className="text-muted" />
                    <p className="text-sm text-muted text-center">지도를 클릭해 위치를 지정하세요</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('menu')}
                    className="flex items-center gap-1.5 text-xs text-fg2 bg-surface2 hover:bg-popover px-3 py-1.5 rounded-lg w-fit transition-colors"
                  >
                    <ArrowLeft size={14} />
                    뒤로
                  </button>
                </>
              ) : mode === 'search' ? (
                <>
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Search size={40} className="text-muted" />
                    <p className="text-sm text-muted text-center">오른쪽 지도에서 장소를 검색하세요</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMode('menu'); setSearchKeyword(''); setSearchResults([]); setSearchStatus('idle'); }}
                    className="flex items-center gap-1.5 text-xs text-fg2 bg-surface2 hover:bg-popover px-3 py-1.5 rounded-lg w-fit transition-colors"
                  >
                    <ArrowLeft size={14} />
                    뒤로
                  </button>
                </>
              ) : mode === 'reorder' ? (
                <>
                  <p className="text-base font-semibold text-fg">여행순서 바꾸기</p>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <SpotList
                      spots={localSpots}
                      onReorder={handleReorder}
                      onDelete={handleDeleteInReorder}
                      onDragStart={(spot) => panTo(spot.lat, spot.lng)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                    <div className="flex items-start gap-2">
                      <Lightbulb size={12} className="text-muted mt-0.5 shrink-0" />
                      <p className="text-xs text-muted">⠿ 을 누르고 위아래로 옮기면 순서를 바꿀 수 있습니다.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lightbulb size={12} className="text-muted mt-0.5 shrink-0" />
                      <p className="text-xs text-muted">마커를 지우려면 × 를 누르세요.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('menu')}
                    className="flex items-center gap-1.5 text-xs text-fg2 bg-surface2 hover:bg-popover px-3 py-1.5 rounded-lg w-fit transition-colors"
                  >
                    <ArrowLeft size={14} />
                    뒤로
                  </button>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-fg">나만의 경로 짜기</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => { setSearchKeyword(''); setSearchResults([]); setSearchStatus('idle'); setMode('search'); }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border text-left w-full hover:bg-surface2 transition-colors"
                    >
                      <Search size={20} className="text-muted shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-fg">촬영지 직접검색</p>
                        <p className="text-xs text-muted">이름으로 바로 추가</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('pinning')}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border text-left w-full hover:bg-surface2 transition-colors"
                    >
                      <MapPin size={20} className="text-muted shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-fg">지도에서 찍기</p>
                        <p className="text-xs text-muted">지도를 눌러 위치 지정</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('reorder')}
                      disabled={localSpots.length < 2}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left w-full transition-colors ${localSpots.length >= 2
                        ? 'border-border hover:bg-surface2'
                        : 'border-border opacity-40 cursor-not-allowed bg-surface2'
                        }`}
                    >
                      <ArrowUpDown size={20} className={`shrink-0 ${localSpots.length >= 2 ? 'text-muted' : 'text-muted'}`} />
                      <div>
                        <p className="text-sm font-medium text-fg">여행순서 바꾸기</p>
                        <p className="text-xs text-muted">방문 순서 편집</p>
                      </div>
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-fg2">나만의 여행 동선 만들기</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted mt-0.5 shrink-0 font-medium">①</span>
                        <p className="text-xs text-muted">촬영지 직접검색 또는 지도에서 찍기 버튼을 눌러 마커를 하나 추가합니다.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted mt-0.5 shrink-0 font-medium">②</span>
                        <p className="text-xs text-muted">추가한 마커의 장소에 사진과 리뷰를 작성합니다.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted mt-0.5 shrink-0 font-medium">③</span>
                        <p className="text-xs text-muted">1,2를 반복하면 마커가 선으로 이어져 나만의 여행 동선이 완성됩니다.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lightbulb size={12} className="text-muted mt-0.5 shrink-0" />
                      <p className="text-xs text-muted">마커 순서를 바꾸려면 여행순서 바꾸기 버튼을 누르면 됩니다.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
