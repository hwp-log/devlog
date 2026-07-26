'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useNaverMapsLoader } from '@/lib/naver/useNaverMapsLoader';
import type { LocalSpot } from '@/lib/types';
import { SpotList } from './SpotList';
import { SpotPopup } from './SpotPopup';
import { findNearbySpots, type NearbySpot } from '@/lib/spot/nearby';
import { searchPlaces, type PlaceResult } from '@/lib/spot/searchPlaces';
import { Search, MapPin, ArrowLeft, List, Maximize2 } from 'lucide-react';

const MERGE_EPSILON_KM = 0.05; // 50m 이내 = 같은 장소로 병합

// 줌 매핑(카카오 level→네이버 zoom 근사, 실화면 보정 대상): 기본 level5≈13 / 검색·찍기 확대 level3≈16
const ZOOM_DEFAULT = 13;
const ZOOM_FOCUS = 16;

// 사용자 조작 전환 질감 단일 소스(0369 보완) — 모든 morph(클릭 포커스·전체보기·검색 추가)가 공유.
// duration 1100 = SDK 기본(~500ms) 절반 속도(1000)에서 10% 추가 감속(사용자 체감 조정 2회 확정).
// easing 'easeOutCubic' = SDK TransitionOptions 기본값 명시(SpotFinder 실측 확증과 동일 어휘)
const SPOT_TRANSITION = { duration: 1100, easing: 'easeOutCubic' };

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

// 마커 HTML(파랑 도트 + 펄스) — 0364 번호 폐기에 이어 0368: 순서 파생 색(첫 초록/끝 빨강)도
// 의미를 잃어 primary 단색 통일. var(--primary) — 지도 div가 테마 스코프 안이라 상속 작동, 다크 자동.
// 목록↔마커 대응은 항목 클릭 시 확대 이동(focusSpot morph)·펄스가 담당(색 구분 불필요 — 0368 확정).
// 바깥 래퍼 translate(-50%,-50%) + anchor(0,0) = 카카오 중앙 앵커 상응. isDark는 그림자만 분기.
// 펄스 애니메이션은 globals.css @keyframes spot-pulse(0.6s) 참조 — 제거 타이머(triggerPulse)와 페어.
function markerContent(opts: { isPulse: boolean; isDark: boolean }): string {
  const { isPulse, isDark } = opts;
  const color = 'var(--primary)';
  const shadow = isDark ? '0 2px 6px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.3)';
  const pulse = isPulse
    ? `<div style="position:absolute;inset:-5px;border-radius:9999px;background:${color};z-index:0;animation:spot-pulse 0.6s ease-out forwards;pointer-events:none"></div>`
    : '';
  return `<div style="transform:translate(-50%,-50%);position:relative;display:inline-flex">
    <div style="position:relative;z-index:1;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:${shadow};cursor:default;width:18px;height:18px"></div>
    ${pulse}
  </div>`;
}

type Mode = 'menu' | 'pinning' | 'search' | 'list' | 'edit' | 'view';

// 사이드 카드 고정 폭 — 실화면 비교용 단일 스위치. 0376: 글쓰기·상세 공용이 되어
// WRITE_ 접두 개명(비율 분기는 fallback으로 존치 — 미래 화면의 비율 사용 여지).
// 현재 426 고정: 카드 426 / 지도 422(=860−426−12). ↔ 'w-full md:w-2/5': 카드 344 / 지도 504.
const SIDE_CARD_WIDTH = 'w-full md:w-[426px]';

// 모바일 판정(0378) — md 미만 = 지도/카드 세로 스택 구간(아래 flex-col md:flex-row와 페어).
// 이 구간에서 팝업은 전체화면 모달로 마운트(기존 확정 표준 "전체화면 모달" 항 — SpotFinder 셸 이식).
// jsdom엔 matchMedia가 없어 가드 — 테스트는 데스크톱 경로(false)로 렌더.
const MOBILE_MQ = '(max-width: 767px)';
const canMatchMedia = () => typeof window.matchMedia === 'function';

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
  // 0376: 글쓰기·상세 모두 fixedSideWidth — 0373 폭 정합(양쪽 860)으로 "상세=비율" 분기의 전제
  // (글쓰기 760 협소 시절의 산물)가 소멸. 미전달=비율 2/5 fallback은 미래 화면용으로 존치.
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
  // destroy한 지도를 자체 기록 — 마커 클린업이 파괴된 GL 지도에 setMap(null)을 호출해
  // removeLayer→getLayer 크래시가 나는 것을 차단. Naver 내부 프로퍼티(map.destroyed 등) 비의존.
  // WeakSet이라 지도 인스턴스 GC 시 자동 소거(누수 없음).
  // (폴리라인은 0364 동선 폐기로 제거 — 이 가드의 나머지 보호 대상은 마커·지도 destroy 경로)
  const destroyedMapsRef = useRef<WeakSet<naver.maps.Map>>(new WeakSet());

  const modeRef = useRef<Mode>('menu');
  const addSpotFromMapRef = useRef<((lng: number, lat: number) => void) | null>(null);
  const fitDoneRef = useRef(false);

  const [mapInstance, setMapInstance] = useState<naver.maps.Map | null>(null);
  const [localSpots, setLocalSpots] = useState<LocalSpot[]>(spots);
  const [activeSpot, setActiveSpot] = useState<LocalSpot | null>(null);
  const [displayedSpot, setDisplayedSpot] = useState<LocalSpot | null>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());
  // 테마 전환 페이드(0370 — SpotFinder 0296 이식): 재생성의 "빈 배경 번쩍 + 타일 촤락"을
  // bg-card 면으로 가림. 첫 마운트는 제외(prevThemeRef null 가드), 해제는 tilesloaded once +
  // 300ms 홀드(+2s failsafe). customStyleId 런타임 교체는 0297 실측 기각(호출 통과·스타일 미반영).
  const [themeFade, setThemeFade] = useState(false);
  const prevThemeRef = useRef<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'ok' | 'zero' | 'error'>('idle');
  // S3-a: 마커 추가 시 근처 기존 촬영지 후보(있으면 재사용 선택 UI)
  const [nearbyChooser, setNearbyChooser] = useState<{ spotId: string; candidates: NearbySpot[] } | null>(null);
  // 0378: 팝업 마운트 슬롯 분기(카드 ↔ 전체화면 모달)의 단일 기준. CSS 노드 전환이 아닌 조건부
  // 마운트 두 슬롯 — 조상 overflow-hidden/transform 컨테이닝 블록 리스크 회피, SpotPopup 인스턴스는
  // 항상 1개(이중 폼 상태 방지). ssr:false(SpotMapWrapper)라 초기값 동기 판독 안전.
  const [isMobile, setIsMobile] = useState(() => canMatchMedia() && window.matchMedia(MOBILE_MQ).matches);
  // 0378: 모달 history 배선. pushedRef = 우리가 쌓은 엔트리 유무(이중 back·이중 close 가드).
  // closeHandleRef = SpotPopup.handleClose 핸들 — 뒤로가기(popstate)가 이 핸들을 경유해야 생성 세션
  // 스팟 제거(0365)가 실행됨. 판정(isCreationSession)은 SpotPopup 단일 소스라 여기서 재추적 금지(§8-②).
  const pushedRef = useRef(false);
  const closeHandleRef = useRef<(() => void) | null>(null);
  // 0382: 시트 열 때 지도 정렬·패딩 배선용. sheetRef = covered 측정 대상(시트 top),
  // restoreScrollRef = 정렬 전 스크롤(닫을 때 복원 — 시트=임시 오버레이 멘탈 모델).
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreScrollRef = useRef(0);

  useEffect(() => {
    if (!canMatchMedia()) return;
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // 0378: 모달 열림 = 엔트리 push. URL 무변경 state-only — SpotFinder(?detail=id)에서 의도적 이탈:
  // 상세 URL은 공유 표면이고 새로고침 복원도 없는 쿼리라 오염만 남김. 네이티브 history(Next 라우터
  // 미경유 = 재마운트 없음, SpotFinder 0224 선례). 스팟 전환(A마커→B마커)은 activeSpot 유지라 엔트리 1개 불변.
  // 브레이크포인트 교차(모달 열린 채 회전 등)는 엔트리만 소비 — 팝업은 카드 슬롯으로 이동.
  // 페이지 이탈 시 잔여 엔트리는 수용 엣지(SpotFinder 동일 — 미처리).
  useEffect(() => {
    if (isMobile && activeSpot && !pushedRef.current) {
      window.history.pushState({ spotPopup: true }, '');
      pushedRef.current = true;
    }
    if (!isMobile && pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
  }, [isMobile, activeSpot]);

  // 0378: 뒤로가기 → 팝업 handleClose 핸들 경유(0365 생성 세션 삭제 포함). consumeHistoryEntry의
  // 프로그램적 back()이 유발한 popstate는 pushedRef=false라 no-op(이중 실행 차단).
  useEffect(() => {
    const onPop = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      if (closeHandleRef.current) closeHandleRef.current();
      else {
        // 핸들 미대입 폴백(대입은 SpotPopup effect — 첫 페인트 직후엔 항상 존재)
        setActiveSpot(null);
        setMode('menu');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 0382 Effect A: 시트 열 때 지도 정렬 → 배경 스크롤 락 → (닫힘) 복원. 순서가 핵심 —
  // 정렬(scrollTo)이 lock보다 먼저여야 유효(잠기면 무효), lock은 iOS 스크롤 체이닝 방지(0378).
  // 키를 activeSpot 객체가 아닌 불리언 sheetOpen으로 — 편집 입력(handleSpotUpdate)이 매번
  // 새 activeSpot을 만들어도 재정렬·복원 중복이 안 생기게(열림/닫힘 전이에만 반응).
  // 선언 순서상 Effect B(패딩·morph)보다 먼저 = 열림 커밋에서 정렬이 측정보다 앞섬.
  const sheetOpen = isMobile && !!activeSpot;
  useEffect(() => {
    if (!sheetOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    // 정렬: 지도 top을 sticky 헤더 바로 아래로 (위 스트립에 지도를 놓기 위한 스크롤).
    restoreScrollRef.current = window.scrollY;
    const mapEl = mapDivRef.current;
    if (mapEl) {
      const headerH = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
      // instant — smooth는 뒤이은 lock과 경쟁해 잘림. 전환 질감은 시트 detail-up(320ms)이 담당.
      window.scrollTo(0, window.scrollY + mapEl.getBoundingClientRect().top - headerH);
    }
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      window.scrollTo(0, restoreScrollRef.current);
    };
  }, [sheetOpen]);

  // 0382 Effect B: 지도 패딩(가림 높이)으로 morph가 마커를 가시 영역 중앙에 놓게 + 그 morph 소유.
  // SpotFinder computeMapPadBottom 정신 계승 — 임베드 지도라 상수 산식 대신 실 rect 측정
  // (헤더·실제 시트 svh·safe-area 자동 반영). Effect A 이후라 지도는 정렬됨. 키를 activeSpot?.id로
  // — 객체 키는 편집 입력마다 재morph. cleanup에서 패딩 0 복원(닫힘·데스크톱·전체보기 정중앙).
  useEffect(() => {
    if (!(isMobile && activeSpot && mapInstance)) return;
    const mapEl = mapDivRef.current;
    const sheetEl = sheetRef.current;
    if (mapEl && sheetEl) {
      // 시트 top은 offsetHeight로 역산 — 이 시점 시트는 detail-up(translateY 100%) 진입 애니메이션
      // 중이라 getBoundingClientRect().top이 화면 밖(≈뷰포트 하단)을 가리켜 covered=0이 됨(실측).
      // offsetHeight는 transform 무관 레이아웃 높이 → 최종 top = 레이아웃 뷰포트 − 시트 높이(fixed bottom-0).
      const sheetTop = document.documentElement.clientHeight - sheetEl.offsetHeight;
      const covered = Math.max(0, mapEl.getBoundingClientRect().bottom - sheetTop);
      mapInstance.setOptions('padding', { bottom: covered });
    }
    focusSpot(activeSpot);
    return () => {
      mapInstance.setOptions('padding', { bottom: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id로만 재실행(편집 입력 재morph 방지), focusSpot/activeSpot 좌표는 id당 고정
  }, [isMobile, activeSpot?.id, mapInstance]);

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

  // 전체 스팟 뷰 산출(0367) — 초기 뷰와 "전체 보기" 버튼이 공유하는 단일 규칙.
  // GL fitBounds는 신뢰 불가 실측 2건(SpotFinderMapNaver:212 퇴화 스팬 무시 · :656 준비 전 빈
  // bounds) → SpotFinder moveToStage2와 같은 "프로젝션 직접 산출" 방식 재사용. 초기 뷰는 전환
  // 질감이 불필요해 morph 대신 setCenter+setZoom(0ms 점프가 정답 — SpotFinder의 기각 사유는
  // 질감이지 기능 아님). 마진 균등 60이라 SpotFinder의 비대칭 마진 보정항은 생략.
  // 규칙(업계 표준 — 단일 지점 bounds는 크기 0이라 fitBounds 과확대):
  //   1개 또는 전부 근접(마커 병합과 같은 MERGE_EPSILON_KM 재사용, 첫 스팟 기준 — 초기 뷰
  //   목적엔 충분) → center + ZOOM_FOCUS(16: 검색·찍기 확대와 동일 맥락의 기확정 상수).
  //   이격 → 산출 줌을 ZOOM_FOCUS 상한으로 클램프(근접 판정을 새는 엣지도 같은 상한).
  // 반환 false = 컨테이너 실측 전(size 0) — 호출부가 rAF 재시도(이전 fitBounds 미적용 증상의 처방).
  // smooth(0369): 초기 로드 = false(0ms 점프 — 0367 판단 불변) / 사용자 조작(전체보기 버튼) =
  // true(morph — 산출은 공유하고 적용 단계만 가름. 질감은 검색 추가와 같은 SDK 기본 ~500ms).
  function fitAllSpots(map: naver.maps.Map, spotList: LocalSpot[], smooth = false): boolean {
    const apply = (center: naver.maps.LatLng | naver.maps.Coord, zoom: number) => {
      if (smooth) map.morph(center as naver.maps.LatLng, zoom, SPOT_TRANSITION);
      else {
        map.setCenter(center);
        map.setZoom(zoom);
      }
    };
    if (spotList.length === 0) return true;
    const allNear = spotList.every(s => haversineKm(spotList[0], s) < MERGE_EPSILON_KM);
    if (spotList.length === 1 || allNear) {
      apply(new naver.maps.LatLng(spotList[0].lat, spotList[0].lng), ZOOM_FOCUS); // ★★★ lat first
      return true;
    }
    const size = map.getSize();
    if (!size || size.width === 0 || size.height === 0) return false;
    let minLat = spotList[0].lat, maxLat = minLat, minLng = spotList[0].lng, maxLng = minLng;
    for (const s of spotList) {
      minLat = Math.min(minLat, s.lat); maxLat = Math.max(maxLat, s.lat);
      minLng = Math.min(minLng, s.lng); maxLng = Math.max(maxLng, s.lng);
    }
    // Mercator 상수 하드코딩 대신 SDK 프로젝션 위임 — GL 도/픽셀 비가 표준 256 예측과 어긋났던
    // 실측 이력(SpotFinder 주석) 준용
    const proj = map.getProjection();
    const pSW = proj.fromCoordToOffset(new naver.maps.LatLng(minLat, minLng));
    const pNE = proj.fromCoordToOffset(new naver.maps.LatLng(maxLat, maxLng));
    const dx = Math.abs(pNE.x - pSW.x);
    const dy = Math.abs(pNE.y - pSW.y);
    const FIT_PADDING = 60; // 구 fitBounds 패딩 60 유지
    const availW = size.width - FIT_PADDING * 2;
    const availH = size.height - FIT_PADDING * 2;
    const dz = Math.log2(Math.min(availW / dx, availH / dy));
    const targetZoom = Math.min(Math.max(map.getZoom() + dz, map.getMinZoom()), ZOOM_FOCUS);
    const center = proj.fromOffsetToCoord(
      new naver.maps.Point((pSW.x + pNE.x) / 2, (pSW.y + pNE.y) / 2),
    );
    apply(center, targetZoom);
    return true;
  }

  // 초기 1회 전체 스팟 뷰(0367) — fitDoneRef로 초기 로드에만. 스팟 추가·삭제 시 재맞춤 없음
  // (추가 흐름의 morph(ZOOM_FOCUS)·panTo·펄스와 충돌 방지). 테마 재생성 시엔 fitDoneRef=true +
  // viewRef 복원(0317)이라 재실행 없음 — 보던 뷰 유지 불변.
  useEffect(() => {
    if (!mapInstance || fitDoneRef.current || spots.length === 0) return;
    fitDoneRef.current = true;
    let frame = 0;
    let tries = 0;
    const attempt = () => {
      if (fitAllSpots(mapInstance, spots)) return;
      if (++tries < 30) frame = requestAnimationFrame(attempt); // 컨테이너 실측 대기(최대 ~0.5s)
    };
    attempt();
    return () => cancelAnimationFrame(frame);
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
  // 같은 좌표(50m 이내) 병합 — 0364 번호 폐기로 병합은 겹침 축소 역할만, 색은 그룹 첫 스팟 기준.
  // 클릭은 마커 리스너(HTML 문자열엔 React 핸들러 불가).
  useEffect(() => {
    if (!mapInstance) return;
    const destroyedMaps = destroyedMapsRef.current; // 안정 WeakSet 참조 캡처(.current 재할당 없음) — 클린업 가드용
    const isDark = resolvedTheme === 'dark';
    const items = groupByProximity(localSpots).map((group) => {
      const isPulse = group.orders.some(o =>
        localSpots.find(s => s.order === o && pulsingIds.has(s.id))
      );
      const marker = new naver.maps.Marker({
        map: mapInstance,
        position: new naver.maps.LatLng(group.representative.lat, group.representative.lng), // ★★★ lat first
        icon: {
          content: markerContent({ isPulse, isDark }),
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
      // 파괴된 지도의 오버레이 해제는 GL removeLayer 크래시 유발 → 스킵(테마 전환 시 별도 커밋에서 발생)
      if (destroyedMaps.has(mapInstance)) return;
      items.forEach(({ marker, clickListener }) => {
        naver.maps.Event.removeListener(clickListener); // 해제는 핸들 기반
        marker.setMap(null);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleMarkerClick은 안정 setter·prop만 사용(리빌드 트리거는 데이터·테마만)
  }, [mapInstance, localSpots, pulsingIds, resolvedTheme]);

  // 폴리라인 없음(0364) — 동선 폐기로 렌더 제거. GL removeLayer→getLayer 크래시의 한 경로도 함께 소멸.
  // 지도 생성 — 명령형 init/destroy (StrictMode 이중 마운트 안전, GL 컨텍스트 해제).
  // 테마 전환 = 파괴·재생성: customStyleId 런타임 교체는 호출은 통과하나 미반영(SpotFinderMapNaver 0297 실측).
  // 첫 렌더 resolvedTheme=undefined 가드로 이중 init 차단. 파괴 직전 viewRef 캡처로 보던 뷰 재개.
  // 선언 위치가 마커·폴리라인 effect 뒤 — 언마운트 클린업은 선언 순서(위→아래)로 실행되므로 오버레이
  // 해제(⑤⑥)가 이 destroy보다 먼저 돌아 "파괴된 지도에 setMap(null)"을 피한다(SpotFinder 0753 순서 선례).
  // 셋업은 마커·폴리라인이 mapInstance 게이트(early-return)라 이 effect가 마지막이어도 첫 마운트엔
  // init→setMapInstance 이후 커밋에 정상 실행 — 순서 영향 없음.
  useEffect(() => {
    if (status !== 'ready' || !resolvedTheme || !mapDivRef.current) return;
    const destroyedMaps = destroyedMapsRef.current; // 안정 WeakSet 참조 캡처(.current 재할당 없음) — 클린업 기록용
    // 0296 이식(0370): 테마 "전환"만 페이드 발동 — 첫 실행(prevThemeRef null)은 제외
    const themeChanged = prevThemeRef.current !== null && prevThemeRef.current !== resolvedTheme;
    prevThemeRef.current = resolvedTheme;
    const fadeInTimer = themeChanged ? window.setTimeout(() => setThemeFade(true), 0) : undefined;
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
    // 0296 이식(0370): 오버레이 걷기 = tilesloaded 1회(once) + 300ms 홀드(마지막 타일 페인트 안착
    // — SpotFinder 0297 실측 단축값. init은 GL 초기화 신호일 뿐 타일 미완이라 부적합).
    // 안전망 2000ms — 타일 실패·이벤트 미도달 시 오버레이 고착 방지. 전환 아니면 아무것도 안 붙임.
    let holdTimer: number | undefined;
    const tilesListener = themeChanged
      ? naver.maps.Event.once(map, 'tilesloaded', () => {
          holdTimer = window.setTimeout(() => setThemeFade(false), 300);
        })
      : undefined;
    const failsafeTimer = themeChanged
      ? window.setTimeout(() => setThemeFade(false), 2000)
      : undefined;
    return () => {
      const c = map.getCenter() as naver.maps.LatLng;
      viewRef.current = { lat: c.lat(), lng: c.lng(), zoom: map.getZoom() };
      naver.maps.Event.removeListener(initListener); // 해제는 핸들 기반 — (target,type,fn)식은 조용히 누수
      if (tilesListener) naver.maps.Event.removeListener(tilesListener);
      if (fadeInTimer !== undefined) clearTimeout(fadeInTimer);
      if (holdTimer !== undefined) clearTimeout(holdTimer);
      if (failsafeTimer !== undefined) clearTimeout(failsafeTimer);
      setMapInstance(null);
      destroyedMaps.add(map); // destroy 직전 기록 — 별도 커밋의 ⑤⑥ 클린업 가드가 참조(테마 전환)
      map.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 재생성 트리거는 로더·테마만(뷰는 viewRef 보존)
  }, [status, resolvedTheme]);

  function triggerPulse(spotId: string) {
    setPulsingIds(prev => new Set(prev).add(spotId));
    // globals.css @keyframes spot-pulse 0.6s와 페어 — HTML 문자열 마커라 onAnimationEnd 불가, 타이머로 제거
    window.setTimeout(() => {
      setPulsingIds(prev => { const ns = new Set(prev); ns.delete(spotId); return ns; });
    }, 600);
  }

  // 스팟 포커스(0369) — 클릭한 좌표를 중심으로 부드럽게 확대(질감은 SPOT_TRANSITION 단일 소스).
  // Math.max(현재줌, ZOOM_FOCUS) — 이미 더 확대해 둔 상태에서 클릭 시 축소되지 않게.
  function focusSpot(spot: LocalSpot) {
    if (!mapInstance) return;
    mapInstance.morph(
      new naver.maps.LatLng(spot.lat, spot.lng),
      Math.max(mapInstance.getZoom(), ZOOM_FOCUS),
      SPOT_TRANSITION,
    );
  }

  function handleMarkerClick(spot: LocalSpot) {
    // 토글 아님 — 같은 마커 재클릭 시 activeSpot이 null로 떨어져 사이드 카드가 메뉴(검색·찍기)로
    // 바뀌던 문제. 마커 클릭 = 항상 보기 팝업(수정·삭제), 닫기는 팝업의 ×·닫기 버튼 전담
    setActiveSpot(spot);
    if (readOnly) {
      setDisplayedSpot(spot);
    }
    // 0382: 모바일은 morph를 Effect B가 소유(정렬·패딩 이후 실행 — 마커를 가시 영역 중앙에).
    // 핸들러 동기 morph는 시트 정렬 전이라 마커가 시트 뒤로 감. 데스크톱만 즉시 focus.
    if (!isMobile) focusSpot(spot); // 0369 — 편집 분기도 이동(기존엔 readOnly만 panTo, 편집은 이동 없던 결함 해소)
    setMode('view');
    triggerPulse(spot.id);
  }

  function handleSpotSelect(spot: LocalSpot) {
    setDisplayedSpot(spot);
    setActiveSpot(spot);
    setMode('view');
    if (!isMobile) focusSpot(spot); // 0369/0382 — 데스크톱 즉시 focus, 모바일은 Effect B 소유
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
    consumeHistoryEntry(); // 보기 팝업의 [삭제]는 onClose 미경유 닫힘 — 엔트리 잔존 방지
  }

  // 0378: 우리가 쌓은 history 엔트리 소비 — 팝업 내부 닫기(✕·취소·삭제)가 상태를 먼저 정리한 뒤
  // 호출. 사용자 가시 결과는 "✕=history.back()"과 동일, 배선만 역방향(0365 판정을 SpotPopup에
  // 남기기 위해 — popstate 쪽이 핸들을 경유). back()이 재유발하는 popstate는 pushedRef 가드로 no-op.
  function consumeHistoryEntry() {
    if (!pushedRef.current) return;
    pushedRef.current = false;
    window.history.back();
  }

  // 팝업 onClose 단일 배선(0378) — 기존 2곳 인라인(setActiveSpot(null)+setMode('menu')) 흡수 + 엔트리 소비
  function handlePopupClose() {
    setActiveSpot(null);
    setMode('menu');
    consumeHistoryEntry();
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
    mapInstance?.morph(new naver.maps.LatLng(lat, lng), ZOOM_FOCUS, SPOT_TRANSITION);
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

  // 팝업 1벌 정의(0378) — 카드 슬롯(md 이상)과 전체화면 모달 슬롯(md 미만)이 공유(프롭 단일 소스).
  // 진입 경로(마커 탭·목록 탭·검색 추가·좌표 찍기·chooser 선택)는 전부 activeSpot 세팅이라 분기 불요.
  // readOnly 콘텐츠는 displayedSpot(카드 크로스페이드 중 잔존 표시용) — 가시성 자체는 activeSpot이 담당.
  function renderPopup() {
    if (readOnly) {
      return displayedSpot ? (
        <SpotPopup
          key={displayedSpot.id}
          spot={displayedSpot}
          readOnly
          closeHandleRef={closeHandleRef}
          onClose={handlePopupClose}
        />
      ) : null;
    }
    return activeSpot ? (
      <SpotPopup
        key={activeSpot.id}
        spot={activeSpot}
        readOnly={!canAddSpot}
        closeHandleRef={closeHandleRef}
        onDelete={canAddSpot ? () => handleDelete(activeSpot.id) : undefined}
        onClose={handlePopupClose}
        onUpdate={handleSpotUpdate}
        onFileSelect={(file) => onPhotoSelect?.(activeSpot.id, file)}
        initialEditing={mode === 'edit'}
      />
    ) : null;
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
        {/* 지도 컨테이너 — md:h-[500px]는 사이드 카드 목록 max-h(readOnly 424·reorder 300, 0342)의 파생 원본. 바꾸면 그 두 값도 함께 */}
        {/* md:flex-1(0377 실측) — flex-1(=flex-basis 0%)은 세로 스택(모바일 flex-col)에서 h-[400px]을
            이기고 계산 높이 0으로 붕괴(자동 높이 컨테이너라 grow 배분 몫도 0 — Chrome 실측 0px).
            grow의 목적은 가로 행에서 남은 폭 채움뿐이므로 md 한정 = 의도 그대로, 모바일은 명시 높이(§5) */}
        {/* isolate(0378 실측) — 네이버 SDK 내부 z-index(저작권 100·내부 최대 10000)가 래퍼(relative
            z-auto = 무컨텍스트)를 지나 루트에서 모달 z-60을 이기고 위에 그려짐. isolation으로 지도
            내부 z를 래퍼 안에 가둠 — 래퍼 자체는 z-auto라 팝오버(50)·탭바(40) 등 바깥 위계 불변.
            모달 z 상향(>10000)안은 SDK 내부 상수와의 경쟁이라 기각 */}
        <div className="isolate relative md:flex-1 h-[400px] md:h-[500px] rounded-xl overflow-hidden">
          {/* 리뷰장소 전체보기 오버레이(0369) — 확대해 돌아다닌 뒤 전체 뷰 복귀. 글쓰기·상세 공용
              (초기 뷰가 양쪽 적용이므로 복귀 수단도 양쪽). z-10 = 지도 위·팝오버(z-50) 아래.
              우상단 = 네이버 기본 컨트롤(로고·저작권·축척, 하단 계열)과 비충돌 — 실화면 확인 항목.
              모양: 알약(pill) + 아이콘 — 지도 위 부유 컨트롤 관례. 데스크톱은 컴팩트(sm:py-1.5),
              모바일만 min-h 44px 터치 타깃 유지(§5 — 축소 요구와 기준선의 양립은 반응형으로).
              text-xs(12px) = §5 하한 준수. 토큰만 사용(다크 자동). smooth=true — 사용자 조작은 morph */}
          {localSpots.length > 0 && (
            <button
              type="button"
              onClick={() => { if (mapInstance) fitAllSpots(mapInstance, localSpots, true); }}
              className="absolute top-3 right-3 z-10 flex items-center gap-1.5 min-h-[44px] sm:min-h-0 sm:py-1.5 px-3 rounded-full border border-border bg-card/95 shadow-md text-xs font-medium text-fg2 hover:bg-popover hover:text-fg transition-colors"
            >
              <Maximize2 size={13} />
              리뷰장소 전체보기
            </button>
          )}
          {/* 테마 전환 페이드 오버레이(0370 — SpotFinder 0296 이식, :1137 클래스 동일).
              z-20 = 전체보기 버튼(z-10) 위·사이드 팝오버(z-50) 아래 — 전환 중 버튼까지 가림이 목적 */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 z-20 bg-card transition-opacity duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${themeFade ? 'opacity-100' : 'opacity-0'}`}
          />
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
            열림 폭: 글쓰기·상세=SIDE_CARD_WIDTH(426 고정, 0376 통일) / 비율 2/5는 fallback. 두 값 모두 완전 리터럴(JIT 스캔).
            md:max-h-[500px] = 지도 md:h-[500px]와 짝(0342 파생 계열) — 한쪽만 바꾸면 행 어긋남/클립.
            상한이 없으면 stretch가 콘텐츠(편집 폼 ≈604)를 따라 행을 늘려 지도(500)와 어긋나고,
            내부 카드의 기존 overflow-y-auto가 영구 미발동(실측 확정). 모바일은 무상한(스택+모달) */}
        <div className={`overflow-hidden flex-shrink-0 md:max-h-[500px] transition-all duration-200 ${(canAddSpot || activeSpot || readOnly) ? `${fixedSideWidth ? SIDE_CARD_WIDTH : 'w-full md:w-2/5'} opacity-100` : 'w-0 opacity-0 pointer-events-none'
          }`}>
          {readOnly ? (
            <div className="bg-card rounded-xl shadow-lg h-full border border-border p-5 relative overflow-hidden">
              {/* 0377: absolute 전환은 md 한정 — 모바일(flex-col)은 카드 높이=콘텐츠라 두 레이어가
                  전부 absolute면 높이가 p-5만 남아 ~42px로 붕괴(팝업이 overflow-hidden에 클립).
                  목록을 flow에 남겨 높이를 유지하고, 크로스페이드는 행 높이(지도 500px)가 있는 md 이상 전용 */}
              <div className={`transition-opacity duration-200 flex flex-col h-full ${activeSpot ? 'md:opacity-0 md:pointer-events-none md:absolute md:inset-0 md:p-5' : 'opacity-100'}`}>
                <p className="text-base font-semibold text-fg mb-3">장소 목록</p>
                {/* 0342: 데스크톱 424 = 지도 md:h-[500px](위 472) − 카드 p-5 상하(40) − 타이틀(24)+mb-3(12).
                    지도 높이를 바꾸면 여기도 함께 (한쪽만 바꾸면 카드 아래 여백/클립).
                    명시 max-h — flex-1 grow는 §5 금지(iOS grow 미계산 붕괴, 0253) */}
                <div className="max-h-[220px] md:max-h-[424px] overflow-y-auto">
                  <SpotList readOnly spots={localSpots} onSelect={handleSpotSelect} />
                </div>
              </div>
              {/* 0377: bg-card — 모바일에서 목록이 flow에 남으므로(위) 팝업 레이어가 투명하면 겹쳐 보임.
                  md 크로스페이드에도 무해(같은 카드면 위 불투명 층) */}
              <div className={`absolute inset-0 bg-card transition-opacity duration-200 overflow-y-auto ${activeSpot ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {/* !isMobile — 모바일 팝업은 아래 전체화면 모달 슬롯(0378). 빈 레이어는 모달 뒤라 비가시 */}
                {!isMobile && renderPopup()}
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
          ) : activeSpot && !isMobile ? (
            // !isMobile(0378) — 모바일 팝업은 아래 전체화면 모달 슬롯. 카드는 메뉴로 폴스루(닫힘 후 상태와 동일)
            <div className="bg-card rounded-xl shadow-lg h-full overflow-y-auto border border-border">
              {renderPopup()}
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
              ) : mode === 'list' ? (
                <>
                  <p className="text-base font-semibold text-fg">장소 보기</p>
                  {/* max-h 산출(0366): 데스크톱 376 = 지도 md:h-[500px](위 472) − p-5(40) − gap-4×2(32)
                      − 타이틀(24) − 뒤로버튼(≈28). 29b6658 reorder 카드 식(300)에서 팁블록(≈47)·gap
                      1개가 빠진 만큼 확대, 안전 하향 360(항목 래핑 여유 — 구판도 313→300 하향).
                      지도 높이를 바꾸면 여기도 함께 (한쪽만 바꾸면 카드 아래 여백/클립).
                      명시 max-h — flex-1 grow는 §5 금지(iOS grow 미계산 붕괴, 0253).
                      목록은 SpotList readOnly 재사용, 클릭 = 마커 클릭과 동일(handleSpotSelect →
                      보기 팝업 + 확대 이동(focusSpot) + 펄스; 팝업 닫기는 기존 배선대로 메뉴 복귀) */}
                  <div className="max-h-[220px] md:max-h-[360px] overflow-y-auto">
                    <SpotList readOnly spots={localSpots} onSelect={handleSpotSelect} />
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
                  <p className="text-base font-semibold text-fg">리뷰 작성</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => { setSearchKeyword(''); setSearchResults([]); setSearchStatus('idle'); setMode('search'); }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border text-left w-full hover:bg-surface2 transition-colors"
                    >
                      <Search size={20} className="text-muted shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-fg">여행지 검색</p>
                        <p className="text-xs text-muted">검색 후 리뷰 작성</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('pinning')}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border text-left w-full hover:bg-surface2 transition-colors"
                    >
                      <MapPin size={20} className="text-muted shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-fg">좌표 찍기</p>
                        <p className="text-xs text-muted">찍은 뒤 리뷰 작성</p>
                      </div>
                    </button>
                    {/* 장소 보기(0366) — 0364에서 reorder 카드와 함께 사라진 "찍은 장소 파악"을 모드로
                        복구(순서 편집·번호·dnd는 미복구). 상시 표시안은 max-h 140 잘림이 답답해 기각 —
                        모드는 카드 전체 높이 사용. 0개면 비활성(구 reorder 항목의 <2 패턴, 조건만 <1) */}
                    <button
                      type="button"
                      onClick={() => setMode('list')}
                      disabled={localSpots.length < 1}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left w-full transition-colors ${localSpots.length >= 1
                        ? 'border-border hover:bg-surface2'
                        : 'border-border opacity-40 cursor-not-allowed bg-surface2'
                        }`}
                    >
                      <List size={20} className="text-muted shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-fg">장소 보기</p>
                        <p className="text-xs text-muted">리뷰장소 한눈에 확인</p>
                      </div>
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-fg2">여행 리뷰 작성 방법</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted mt-0.5 shrink-0 font-medium">①</span>
                        <p className="text-xs text-muted">여행지 검색 또는 좌표 찍기 버튼을 눌러 마커를 하나 추가합니다.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted mt-0.5 shrink-0 font-medium">②</span>
                        <p className="text-xs text-muted">추가한 마커의 장소에 사진과 리뷰를 작성합니다.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {/* 0378: 모바일 팝업 시트 — 전체화면에서 하단 70svh 고정 시트로 전환(사용자 확정).
          글쓰기에서 지도는 탐색 도구가 아니라 작업 캔버스라, 리뷰 작성 중 "방금 찍은 곳"이
          위 영역으로 보여야 함(SpotFinder 상세는 탐색 종료 시점이라 전체화면 유지 — 별개).
          고정 높이 — 드래그·스냅 3단 시트(기각된 안티패턴) 아님. 셸 어휘는 SpotFinder 모바일
          시트(:1159)와 동일 계열(rounded-t-[22px]·border·shadow-2xl), z-60·detail-up 키프레임·
          history·스크롤 락은 0378 그대로. bg-card: SpotPopup은 카드 표면 문법.
          h = max(70svh, 420+env) — §5 "svh 하한 짝"(실기기 Safari svh 축소): 420 = 편집 폼
          상단 필수부(사진 192+이름 58+리뷰 130=380)+여유 40, env는 pb 보정과 동기. 완전 리터럴(JIT).
          시트 밖(위 영역) 탭 = 닫힘 없음(스크림·백드롭 미도입) — 실수 닫힘이 0365 생성 세션
          삭제로 이어지는 것 차단, 닫기는 ✕·취소·뒤로가기만. 위 영역 포인터는 지도에 도달.
          스크롤러: 명시 h-full(flex-grow 금지 §5·0253) + overscroll-contain(스크롤 락 페어) +
          pb 88+env = 탭바 pill이 시트 위에 그려지는 기존 스태킹 사항 보정(SpotFinder :326 관례).
          overflow-hidden = 상단 radius 클립. */}
      {isMobile && activeSpot && (
        <div ref={sheetRef} className="md:hidden fixed inset-x-0 bottom-0 z-[60] h-[max(70svh,calc(420px+env(safe-area-inset-bottom)))] bg-card rounded-t-[22px] border border-border shadow-2xl overflow-hidden animate-[detail-up_320ms_cubic-bezier(0.32,0.72,0,1)]">
          <div className="h-full overflow-y-auto overscroll-contain pb-[calc(88px+env(safe-area-inset-bottom))]">
            {renderPopup()}
          </div>
        </div>
      )}
    </div>
  );
}
