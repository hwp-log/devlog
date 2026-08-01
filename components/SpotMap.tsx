'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useNaverMapsLoader } from '@/lib/naver/useNaverMapsLoader';
import type { LocalSpot } from '@/lib/types';
import { SpotList } from './SpotList';
import { SpotPopup } from './SpotPopup';
import { findNearbySpots, type NearbySpot } from '@/lib/spot/nearby';
import { searchPlaces, type PlaceResult } from '@/lib/spot/searchPlaces';
import { getSpotMeta } from '@/lib/spot/spotMeta';

// getSpotMeta 반환 shape(구조 호환) — 'use server' 모듈에서 타입 import를 피하려 로컬 선언(런타임 export 규칙).
type SpotMeta = { address: string | null; nearestStation: string | null; transitMinutes: number | null; transitMode: string | null };
import { theme } from '@/lib/theme';
import { Search, MapPin, ArrowLeft, List, Maximize2 } from 'lucide-react';

const MERGE_EPSILON_KM = 0.05; // 50m 이내 = 같은 장소로 병합
const PRIMARY = theme.common.primary; // 0390: 선택 pill 리터럴(0292 — 다크 var() 평탄화 회피, SpotFinder 미러)

// 0390: HTML 문자열 아이콘에 들어가는 사용자 데이터(스팟명) 최소 이스케이프 — SpotFinderMapNaver:48 미러
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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

// 마커 HTML(장소명 라벨 pill + 파랑 도트 + 펄스) — 0390: SpotFinder markerContent 이식.
//   색은 0368 primary 단색 유지(0364 순서색·getSpotColor 3색 부활 안 함). isDark 그림자 분기 유지.
// 스택 구조 [라벨 pill][도트] 하단앵커 translate(-50%, calc(-100%+도트반경)) + anchor(0,0) →
//   도트 중심이 좌표 고정(0368 중앙앵커와 동일 위치) → 클릭·펄스·focusSpot(0388) 위치 무변.
// 라벨: 이름 있을 때만(원시 찍기 미명명 name:'' 은 pill 생략·도트만). max-width+ellipsis로 50자(0331)
//   상한이 지도를 가리지 않게 끊음(SpotFinder는 nowrap 무보정 — 지도 크기 차이로 여기선 보강).
// 병합(50m, groupByProximity) 그룹은 대표 이름만 나오므로 extraCount>0 이면 "+N"(SpotFinder 클러스터
//   개수 어휘 — pill 문맥이라 총개수 아닌 추가분). 개별 병합 스팟은 사이드 목록에서 선택(기존 배선).
// 다크 pill 색은 JS 인라인 리터럴(0292 — 인라인 var() 다크 평탄화 재발 방지, SpotFinder 바이트 원복).
//   라이트는 var 토큰(--card/--border/--fg2) 경유. 선택 pill = primary(0368 단색) + zIndex 상향으로 겹침 승자.
// 펄스 애니메이션은 globals.css @keyframes spot-pulse(0.6s) 참조 — 제거 타이머(triggerPulse)와 페어.
function markerContent(opts: { name: string; extraCount: number; isPulse: boolean; selected: boolean; isDark: boolean }): string {
  const { name, extraCount, isPulse, selected, isDark } = opts;
  const color = 'var(--primary)';
  const shadow = isDark ? '0 2px 6px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.3)';
  const pulse = isPulse
    ? `<div style="position:absolute;inset:-5px;border-radius:9999px;background:${color};z-index:0;animation:spot-pulse 0.6s ease-out forwards;pointer-events:none"></div>`
    : '';
  const dot = `<div style="position:relative;display:inline-flex">
    <div style="position:relative;z-index:1;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:${shadow};width:18px;height:18px"></div>
    ${pulse}
  </div>`;

  const trimmed = name.trim();
  let pill = '';
  if (trimmed) {
    // 이름 span은 min-width:0 + ellipsis로 축약, +N은 flex:none으로 항상 노출(긴 이름에도 개수 확인 성립).
    const nameSpan = `<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(trimmed)}</span>`;
    const extraSpan = extraCount > 0
      ? `<span style="flex:none;opacity:0.7;font-weight:700;margin-left:4px">+${extraCount}</span>`
      : '';
    const pillSize = selected ? 'font-size:14px;padding:4px 11px;' : 'font-size:12px;padding:3px 9px;';
    const pillColor = selected
      ? (isDark
        ? `background:linear-gradient(to bottom,color-mix(in srgb,${PRIMARY} 82%,#fff),${PRIMARY});color:#fff;border:1px solid ${PRIMARY};box-shadow:inset 0 1px 0 rgba(255,255,255,0.2),0 2px 6px rgba(0,0,0,0.4);`
        : `background:${PRIMARY};color:#fff;border:1px solid ${PRIMARY};box-shadow:none;`)
      : (isDark
        ? 'background:linear-gradient(to bottom,#33383d,var(--surface2));color:var(--fg2);border:1px solid rgba(255,255,255,0.5);box-shadow:inset 0 1px 0 rgba(255,255,255,0.14),0 2px 6px rgba(0,0,0,0.4);'
        : 'background:var(--card);color:var(--fg2);border:1px solid var(--border);box-shadow:none;');
    pill = `<span style="${pillSize}${pillColor}border-radius:999px;max-width:140px;display:flex;align-items:center;margin-bottom:4px">${nameSpan}${extraSpan}</span>`;
  }

  return `<div style="position:relative;width:0;height:0">
    <div style="position:absolute;left:0;top:0;transform:translate(-50%, calc(-100% + 9px));display:flex;flex-direction:column;align-items:center;cursor:pointer">${pill}${dot}</div>
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
const REDUCE_MQ = '(prefers-reduced-motion: reduce)';
const canMatchMedia = () => typeof window.matchMedia === 'function';

// 0386: 시트 열기·닫기 연출 단일 소스(goal 8). CSS 키프레임은 duration 무지정(from/to만) —
// 아래 상수가 인라인 animationDuration과 JS failsafe 타이머를 동시에 구동해 드리프트 차단.
const SHEET_OPEN_MS = 320; // detail-up (0378 값 유지)
const SHEET_CLOSE_MS = 240; // detail-down
// 0396: 검색 자동검색 — 타이핑 멈춤 300ms 뒤 발사(표준 검색 디바운스), 2자 미만은 미발사(1자=노이즈·과호출)
const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LEN = 2;
// 열기 fullscreen 전환 커버(0370 방식) — 즉시 opaque로 덮고 이 홀드 뒤 페이드아웃.
// double-rAF는 이르다(0370: 재생성 tilesloaded+300ms 선례) — autoResize·GL 재래스터 안착분 확보.
const MAP_FADE_HOLD_MS = 120;
// 0388: 커버 페이드아웃(걷힘) 지속. 닫기 페이드-인은 SHEET_CLOSE_MS 공유(하강 종료 = 완전 불투명, 드리프트
// 없음). 닫기는 morph 없어 교체↔페이드아웃 사이 홀드 불요(페이드아웃 선단이 raster 안착 가림).
// 값: 걷힘이 빨라 완화(2배→추가 1.5배: 열기 750 / 닫기·인터럽트 450).
const SHEET_OPEN_COVER_OUT_MS = 750; // 열기 커버 걷힘
const SHEET_COVER_OUT_MS = 450; // 닫기 커버 걷힘 + 인터럽트 정리

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
  // 0390: 선택 마커 강조를 rebuild 없이 setIcon으로 전이(SpotFinder 766-782 미러 — mass 탈부착=GL 프리즈
  //   회피). markersRef = 대표id→{marker,렌더파라미터}, groupIndexRef = 스팟id→대표id(병합 스팟 역참조).
  const markersRef = useRef<Map<string, { marker: naver.maps.Marker; name: string; extraCount: number; isPulse: boolean }>>(new Map());
  const groupIndexRef = useRef<Map<string, string>>(new Map());
  const activeSpotRef = useRef<LocalSpot | null>(null); // rebuild가 activeSpot deps 없이 현재 선택을 읽음
  const prevSelectedRepRef = useRef<string | null>(null); // 직전 강조 대표id — 선택 전이 시 해제 대상
  const localSpotsRef = useRef<LocalSpot[]>(spots); // 0392: getSpotMeta 비동기 응답이 await 사이 stale 없이 최신 목록 참조

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
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ok' | 'zero' | 'error'>('idle');
  // S3-a: 마커 추가 시 근처 기존 촬영지 후보(있으면 재사용 선택 UI)
  const [nearbyChooser, setNearbyChooser] = useState<{ spotId: string; candidates: NearbySpot[] } | null>(null);
  // 0395: getSpotMeta 조회 진행 중인 스팟 id — 팝업이 "확인 중"을 대기/null 구분해 표시(fetchAndApplyMeta가 set·clear)
  const [metaPendingIds, setMetaPendingIds] = useState<Set<string>>(() => new Set());
  // 0396 ②: findNearbySpots 조회 중인 스팟 id — 시트를 먼저 올리고(모바일) 콘텐츠는 대기로 둔다(chooser/편집 flash 방지)
  const [nearbyPendingId, setNearbyPendingId] = useState<string | null>(null);
  const searchSeqRef = useRef(0); // 0396 ①: 자동검색 응답 순서 역전 방지 — 최신 요청만 반영
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 0378: 팝업 마운트 슬롯 분기(카드 ↔ 전체화면 모달)의 단일 기준. CSS 노드 전환이 아닌 조건부
  // 마운트 두 슬롯 — 조상 overflow-hidden/transform 컨테이닝 블록 리스크 회피, SpotPopup 인스턴스는
  // 항상 1개(이중 폼 상태 방지). ssr:false(SpotMapWrapper)라 초기값 동기 판독 안전.
  const [isMobile, setIsMobile] = useState(() => canMatchMedia() && window.matchMedia(MOBILE_MQ).matches);
  // 0378: 모달 history 배선. pushedRef = 우리가 쌓은 엔트리 유무(이중 back·이중 close 가드).
  // closeHandleRef = SpotPopup.handleClose 핸들 — 뒤로가기(popstate)가 이 핸들을 경유해야 생성 세션
  // 스팟 제거(0365)가 실행됨. 판정(isCreationSession)은 SpotPopup 단일 소스라 여기서 재추적 금지(§8-②).
  const pushedRef = useRef(false);
  const closeHandleRef = useRef<(() => void) | null>(null);
  // 0382→0383: sheetRef = 시트 실측(covered = 시트 offsetHeight — 지도 풀스크린이라 곧 가림 높이).
  const sheetRef = useRef<HTMLDivElement | null>(null);
  // 0386: 닫기 연출. closingSpot = activeSpot이 null로 정리된 뒤에도 시트에 그릴 스냅샷(exit 애니용) —
  // source-of-truth(activeSpot·localSpots·history)는 즉시 정리하고 프레젠테이션만 SHEET_CLOSE_MS 지연.
  const [closingSpot, setClosingSpot] = useState<LocalSpot | null>(null);
  // 0386→0388: fullscreen↔카드 전환 커버(0370 방식). 열기·닫기 공용 단일 state — opacity(덮기)와
  // ms(그 opacity에 도달하는 transition 지속)를 함께 지정. ms:0=즉시(열기-인), ms>0=페이드. 전이 규칙은
  // §goal7: 인터럽트 시 열기 분기가 닫기-인을 덮어써 페이드아웃(last-writer-wins). persistent 노드라 0↔1 신뢰.
  const [cover, setCover] = useState<{ opacity: 0 | 1; ms: number }>({ opacity: 0, ms: 0 });
  const [reduced, setReduced] = useState(() => canMatchMedia() && window.matchMedia(REDUCE_MQ).matches);
  const prevActiveIdRef = useRef<string | null>(null); // activeSpot?.id 이전값 — 열림/닫힘 전이 판정
  const lastActiveSpotRef = useRef<LocalSpot | null>(null); // 마지막 non-null activeSpot — 닫힘 스냅샷 소스
  const sheetAnimRef = useRef<Animation | null>(null); // 진행 중 시트 WAAPI 애니(인터럽트 cancel·언마운트 정리 대상)
  const animedKeyRef = useRef<string | null>(null); // 마지막 재생 방향+id — 동일 phase 중복 재생 가드
  const fadeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 열기 커버 홀드
  // 닫힘 애니 진행 플래그(ref — Effect B passive cleanup이 최신값을 읽어 padding 복원을 finishClose로 미룸).
  const closingActiveRef = useRef(false);

  useEffect(() => {
    if (!canMatchMedia()) return;
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!canMatchMedia()) return;
    const mq = window.matchMedia(REDUCE_MQ);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
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

  // 0394: chooser 활성 시 closeHandleRef를 여기서 소유 — chooser는 SpotPopup 미마운트라(시트/카드가
  //   chooser UI 렌더) SpotPopup가 핸들을 대입하지 않는다. 뒤로가기(popstate)가 이 핸들을 경유해 미저장
  //   생성 세션 스팟을 제거(0365 계열)한다. popstate가 이미 엔트리를 소비(pushedRef=false)했으므로 back() 재호출
  //   금지 → localSpots에서 직접 제거. SpotPopup 언마운트가 ref를 null로 비운 뒤(child cleanup) 이 parent
  //   effect가 대입하고, chooser 해소로 팝업이 뜨면 SpotPopup가 다시 소유(child effect 우선). 값 없을 땐 무대입.
  // 0396: 조건에 nearbyPendingId 포함 — 후보 조회 대기 중에도 시트엔 SpotPopup이 아닌 대기 콘텐츠라
  //   closeHandleRef를 여기서 소유해야 뒤로가기가 미저장 스팟을 제거(대기·chooser 둘 다 같은 배선).
  useEffect(() => {
    const spotId = nearbyChooser?.spotId ?? nearbyPendingId;
    if (!(isMobile && spotId)) return;
    closeHandleRef.current = () => {
      const next = localSpotsRef.current
        .filter((s) => s.id !== spotId)
        .map((s, i) => ({ ...s, order: i + 1 }));
      setLocalSpots(next);
      onSpotsChange?.(next);
      setNearbyChooser(null);
      setNearbyPendingId(null);
      setActiveSpot(null);
      setMode('menu');
    };
  }, [isMobile, nearbyChooser, nearbyPendingId, onSpotsChange]);

  // 0383: 시트 열림 = 지도 래퍼를 fixed 풀스크린으로 토글(§1 클래스 분기)에도 재사용하는 파생.
  // isMobile 전제 — 데스크톱은 항상 false라 지도가 flow 카드에 머묾(무변, CDP 1280 실측 확인).
  // 0386: closingSpot 동안도 true 유지 — 닫힘 애니(240ms) 내내 지도 풀스크린을 유지하고
  // 시트가 다 내려간 뒤(finishClose) 카드로 복귀시킨다(지도가 먼저 튀지 않게, goal 2).
  const sheetOpen = isMobile && (!!activeSpot || !!closingSpot);
  const sheetClosing = isMobile && !activeSpot && !!closingSpot;

  // 0386: 닫힘 애니 종료(WAAPI finished 프로미스가 호출) — 시트 언마운트 + 지도 카드 복귀 +
  // 미뤄둔 padding 복원(확인 1). animedKeyRef 리셋 = 같은 스팟 재개방 시 재생되도록.
  function finishClose() {
    closingActiveRef.current = false;
    if (mapInstance) mapInstance.setOptions('padding', { bottom: 0 });
    sheetAnimRef.current = null;
    animedKeyRef.current = null;
    // 교체(fullscreen→card)와 커버 페이드아웃을 같은 배치로 — 커버 아래에서 카드 지도 등장(goal 2·3).
    // 호출부(WAAPI finished)가 non-reduced 전용이라 reduced에선 커버 미동작.
    setClosingSpot(null);
    setCover({ opacity: 0, ms: SHEET_COVER_OUT_MS });
  }

  // 0386: activeSpot non-null↔null 전이만 관측 — 닫기 5경로(✕·취소·저장·삭제·popstate) 핸들러는 무변.
  // useLayoutEffect(pre-paint): 열기 시 fullscreen 플립과 커버 opaque를 같은 프레임에 올려 stretched
  // 프레임 노출을 막는다(확인 2). 데스크톱/reduced는 즉시 처리(연출 없음).
  useLayoutEffect(() => {
    const prevId = prevActiveIdRef.current;
    prevActiveIdRef.current = activeSpot?.id ?? null;
    if (activeSpot) lastActiveSpotRef.current = activeSpot;
    if (!isMobile) {
      // 닫힘 중 데스크톱 전환(회전 등) — 진행 중 닫힘 포기. stale-true로 남으면 Effect B cleanup의
      // padding 복원이 계속 막혀 지도 앵커가 어긋난다(전이 effect는 layout이라 Effect B passive보다 먼저 실행).
      if (closingActiveRef.current) {
        closingActiveRef.current = false;
        sheetAnimRef.current?.cancel(); // 고아 애니 취소(finished는 아래 effect의 catch가 흡수)
        setClosingSpot(null);
        setCover({ opacity: 0, ms: 0 }); // 래퍼가 카드가 되므로 커버 즉시 off(잔존 방지)
      }
      return;
    }
    const wasOpen = !!prevId;
    const isOpen = !!activeSpot;
    if (!wasOpen && isOpen) {
      // 열기: 진행 중이던 닫힘 취소(재진입, goal 5) + fullscreen 전환 커버.
      // interrupting = 닫힘 애니를 가로챈 재진입 → 지도가 이미 풀스크린이라 card→fullscreen 플립이
      // 없음 → 커버 불요(불필요한 bg-card 플래시 방지).
      const interrupting = closingActiveRef.current;
      // 인터럽트: 아래 애니 effect의 cancel은 finished를 catch로 흘려 finishClose를 안 타므로,
      // closingActiveRef 해제는 여기가 단일 지점(stale-true → padding 복원 차단 방지).
      closingActiveRef.current = false;
      setClosingSpot(null);
      if (!reduced) {
        if (interrupting) {
          // 닫는 중 마커 탭: 진행 중이던 닫기 커버(페이드-인)를 페이드아웃으로 정리(§goal7, 깜빡임 방지).
          // 지도는 이미 풀스크린이라 card→fullscreen 플립 없음 → 열기 커버(즉시 opaque) 불요.
          if (fadeHoldTimerRef.current) clearTimeout(fadeHoldTimerRef.current);
          setCover({ opacity: 0, ms: SHEET_COVER_OUT_MS });
        } else {
          setCover({ opacity: 1, ms: 0 }); // pre-paint 즉시 opaque(card→fullscreen 플립·stretched 프레임 가림)
          if (fadeHoldTimerRef.current) clearTimeout(fadeHoldTimerRef.current);
          // 홀드 뒤 페이드아웃 — autoResize(Effect B)·morph·GL 재래스터 안착분 확보(double-rAF 폐기)
          fadeHoldTimerRef.current = setTimeout(() => setCover({ opacity: 0, ms: SHEET_OPEN_COVER_OUT_MS }), MAP_FADE_HOLD_MS);
        }
      }
    } else if (wasOpen && !isOpen && !reduced) {
      // 닫기: 스냅샷으로 시트·풀스크린 유지. detail-down 재생·종료 감지는 아래 WAAPI effect가 담당
      // (finished 프로미스 → finishClose). padding 복원은 finishClose로 지연(확인 1).
      closingActiveRef.current = true;
      setClosingSpot(lastActiveSpotRef.current);
      // 닫기 커버 페이드-인: 하강과 동시에 SHEET_CLOSE_MS 동안 불투명해짐(교체 순간을 가림, goal 1).
      // 열기 직후 급속 닫힘 시 잔여 홀드 타이머가 닫기 중 커버를 꺼버리는 것 차단.
      if (fadeHoldTimerRef.current) { clearTimeout(fadeHoldTimerRef.current); fadeHoldTimerRef.current = null; }
      setCover({ opacity: 1, ms: SHEET_CLOSE_MS });
    }
    // reduced 닫기: closingSpot 미설정 → 즉시 언마운트(closingActiveRef false라 Effect B가 padding 즉시 복원).
    // deps는 activeSpot 객체 — 편집(같은 id) 재실행 시 lastActiveSpotRef를 최신으로 유지(전이 분기는 no-op).
  }, [activeSpot, isMobile, reduced]);

  // 0387: 시트 슬라이드는 WAAPI로 — 노드 재사용 상태에서 animation-name 교체가 재시작 안 되는
  // iOS Safari 거동 우회(el.animate는 명시적 재생). phase 기반(activeSpot=열기 / closingSpot=닫기)이라
  // 닫힘 재마운트(render B) 시점에 sheetRef가 유효. useLayoutEffect = 첫 paint 전 시작(flash 없음).
  useLayoutEffect(() => {
    if (!isMobile || reduced) return; // reduced/데스크톱: animate 없이 즉시(goal 7)
    const el = sheetRef.current;
    if (!el) return; // render A(언마운트 순간)엔 null → 스킵, closingSpot 세팅된 render B에서 재생
    const dir = activeSpot ? 'open' : (closingSpot ? 'close' : null);
    const id = activeSpot?.id ?? closingSpot?.id ?? null;
    if (!dir || !id) return;
    const key = `${dir}:${id}`;
    if (animedKeyRef.current === key) return; // 같은 방향 중복 재생 방지(인터럽트 후속 렌더 등)
    animedKeyRef.current = key;
    sheetAnimRef.current?.cancel(); // 진행 중 애니 취소 후 새로 시작(인터럽트, goal 3)
    const frames = dir === 'open'
      ? [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }]
      : [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }];
    const anim = el.animate(frames, {
      duration: dir === 'open' ? SHEET_OPEN_MS : SHEET_CLOSE_MS, // 상수 참조(goal 6)
      easing: 'cubic-bezier(0.32,0.72,0,1)',
      fill: 'forwards',
    });
    sheetAnimRef.current = anim;
    // finished: 정상 완주 → finishClose / cancel(인터럽트·언마운트)이면 reject → catch로 흡수하고
    // finishClose 미호출(goal 4). 열기도 cancel 가능성 있어 catch 필수(unhandled rejection 방지).
    if (dir === 'close') anim.finished.then(() => finishClose()).catch(() => {});
    else anim.finished.catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id 전이 기준, finishClose/setClosingSpot는 안정 참조
  }, [isMobile, reduced, activeSpot?.id, closingSpot?.id]);

  useEffect(() => () => {
    sheetAnimRef.current?.cancel(); // 진행 중 애니 취소(goal 5)
    closingActiveRef.current = false; // 언마운트 시 stale-true 정리
    if (fadeHoldTimerRef.current) clearTimeout(fadeHoldTimerRef.current);
  }, []);

  // 0383 Effect B: 지도 풀스크린 전환을 확정(autoResize)하고 가림 높이만큼 padding.bottom을 줘
  // morph가 마커를 가시 상단 스트립 중앙에 놓게 + 그 morph를 소유(핸들러 동기 morph는 모바일 미실행).
  // 풀스크린이면 지도 bottom = 뷰포트 bottom, 시트 top = 뷰포트 − 시트높이 → covered = 시트 offsetHeight
  // (측정 단순화, 지도 rect·detail-up 애니메이션 위치 의존 제거). 키를 activeSpot?.id로 — 객체 키는
  // 편집 입력(handleSpotUpdate)마다 재morph. A→B 마커 전환은 id 변화로 재실행(패딩·morph 재적용).
  // cleanup에서 패딩 0 복원(닫힘·데스크톱·전체보기 정중앙).
  useEffect(() => {
    if (!(isMobile && activeSpot && mapInstance)) return;
    const mapEl = mapDivRef.current;
    const sheetEl = sheetRef.current;
    if (mapEl) {
      // ResizeObserver(relayout effect) 선점 — 풀스크린 크기를 lastSizeRef에 미리 기록하면
      // 뒤이은 관찰자 콜백이 크기 불변 가드로 no-op → 관찰자의 setCenter가 아래 morph를 가로채지 못함.
      // (0382는 지도 400 고정이라 관찰자 미발화 → 이 선점은 풀스크린 전환의 신규 필요분)
      const r = mapEl.getBoundingClientRect();
      lastSizeRef.current = { w: r.width, h: r.height };
      mapInstance.autoResize(); // 풀스크린 캔버스 즉시 반영(관찰자 순서와 무관하게 morph 전 확정)
    }
    if (sheetEl) mapInstance.setOptions('padding', { bottom: sheetEl.offsetHeight });
    focusSpot(activeSpot);
    return () => {
      // 0386: 닫힘 애니 진행 중이면 복원을 finishClose로 미룸 — 시트 내려가는 240ms 동안 지도가
      // padding 재앵커로 슬금 움직이는 것 차단(확인 1). A→B 전환·isMobile 해제·테마 재생성은 false라 즉시 복원.
      if (!closingActiveRef.current) mapInstance.setOptions('padding', { bottom: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id로만 재실행(편집 입력 재morph 방지), focusSpot/activeSpot 좌표는 id당 고정
  }, [isMobile, activeSpot?.id, mapInstance]);

  // modeRef·addSpotFromMapRef를 렌더마다 최신값으로 갱신 (stale closure 방지)
  modeRef.current = mode;
  localSpotsRef.current = localSpots; // 0392: 비동기 메타 패치가 최신 목록을 읽도록 동기
  addSpotFromMapRef.current = async (lng: number, lat: number) => {
    const id = addSpot('', lng, lat);
    void fetchAndApplyMeta(id, lat, lng, true); // 0392: 찍기 = 주소·교통 둘 다(주소 없음 → 역지오코딩)
    // localSpotsRef 최신 스팟에서 세팅(0395 메타 레이스 방지 — 리터럴로 덮으면 병합된 주소·교통 누락).
    const setActive = () => setActiveSpot(localSpotsRef.current.find((s) => s.id === id) ?? { id, name: '', lat, lng, order: localSpots.length + 1 });
    // 0396 ②: 모바일은 후보 조회 전에 시트를 올린다 — 후보는 chooser 여부만 결정하지 편집 폼엔 불필요.
    //   대기는 nearbyPending 콘텐츠가 덮어 편집 폼→chooser flash 방지(0394 속성 유지). 데스크톱은 사이드
    //   카드 상시 노출이라 상승 지연이 없어 조회 뒤 세팅(무변).
    if (isMobile) { setActive(); setNearbyPendingId(id); }
    setMode('edit');
    // S3-a: 근처 기존 촬영지 후보 조회. 0384: try/catch — throw해도 후보 없음으로 폴스루(스팟 보존, goal 8).
    let candidates: NearbySpot[] = [];
    try { candidates = await findNearbySpots(lat, lng); } catch { candidates = []; }
    setNearbyPendingId((prev) => (prev === id ? null : prev)); // 대기 종료
    const alive = localSpotsRef.current.some((s) => s.id === id); // 조회 중 취소·삭제 가드(유령 chooser 방지)
    if (!isMobile && alive) setActive();
    if (candidates.length > 0 && alive) setNearbyChooser({ spotId: id, candidates });
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
    const markerIndex = markersRef.current; // 클린업 시점 ref 재조회 경고 회피 — 같은 Map 캡처
    const groupIndex = new Map<string, string>();
    markerIndex.clear();
    const activeId = activeSpotRef.current?.id ?? null; // rebuild 시점 선택 유지(펄스 rebuild가 강조 지우지 않게)
    const items = groupByProximity(localSpots).map((group) => {
      const rep = group.representative;
      const members = group.orders.map(o => localSpots.find(s => s.order === o)).filter((s): s is LocalSpot => !!s);
      members.forEach(s => groupIndex.set(s.id, rep.id)); // 병합 스팟도 대표 마커로 역참조(목록 선택 강조용)
      const isPulse = members.some(s => pulsingIds.has(s.id));
      const selected = !!activeId && members.some(s => s.id === activeId);
      const extraCount = group.orders.length - 1;
      const marker = new naver.maps.Marker({
        map: mapInstance,
        position: new naver.maps.LatLng(rep.lat, rep.lng), // ★★★ lat first
        icon: {
          content: markerContent({ name: rep.name, extraCount, isPulse, selected, isDark }),
          anchor: new naver.maps.Point(0, 0), // 콘텐츠 하단앵커 translate와 페어 = 도트 중심이 좌표
        },
        zIndex: selected ? 10 : 1,
      });
      markerIndex.set(rep.id, { marker, name: rep.name, extraCount, isPulse });
      const clickListener = naver.maps.Event.addListener(marker, 'click', () =>
        handleMarkerClick(rep)
      );
      return { marker, clickListener };
    });
    groupIndexRef.current = groupIndex;
    return () => {
      // 파괴된 지도의 오버레이 해제는 GL removeLayer 크래시 유발 → 스킵(테마 전환 시 별도 커밋에서 발생)
      if (destroyedMaps.has(mapInstance)) return;
      items.forEach(({ marker, clickListener }) => {
        naver.maps.Event.removeListener(clickListener); // 해제는 핸들 기반
        marker.setMap(null);
      });
      markerIndex.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleMarkerClick은 안정 setter·prop만 사용(리빌드 트리거는 데이터·테마만)
  }, [mapInstance, localSpots, pulsingIds, resolvedTheme]);

  // 0390: activeSpot을 ref로 미러 — 위 rebuild(펄스·데이터·테마)가 activeSpot을 deps에 넣지 않고도
  //   현재 선택 강조를 유지(그래야 선택 변경이 rebuild=mass 탈부착을 유발하지 않음, GL 프리즈 회피).
  useEffect(() => { activeSpotRef.current = activeSpot; }, [activeSpot]);

  // 0390: 선택 마커 강조 전이 — SpotFinder 766-782 미러. setIcon만(탈부착 없음)이라 시트 애니 중 GL 프리즈
  //   회피. 병합 스팟 선택은 groupIndexRef로 대표 마커에 귀속. 테마 전환은 rebuild가 재적용(파괴된 마커
  //   setIcon 방지 위해 deps서 제외 — isDark는 선택 전이 시점 클로저값, 그 사이 테마 변경은 rebuild 담당).
  useEffect(() => {
    const isDark = resolvedTheme === 'dark';
    const reIcon = (repId: string, selected: boolean) => {
      const entry = markersRef.current.get(repId);
      if (!entry) return;
      entry.marker.setIcon({
        content: markerContent({ name: entry.name, extraCount: entry.extraCount, isPulse: entry.isPulse, selected, isDark }),
        anchor: new naver.maps.Point(0, 0),
      });
      entry.marker.setZIndex(selected ? 10 : 1);
    };
    const nextRepId = activeSpot ? (groupIndexRef.current.get(activeSpot.id) ?? null) : null;
    const prevRepId = prevSelectedRepRef.current;
    if (prevRepId && prevRepId !== nextRepId) reIcon(prevRepId, false);
    if (nextRepId) reIcon(nextRepId, true);
    prevSelectedRepRef.current = nextRepId;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택 전이만 관측(테마 전환은 rebuild가 재적용); resolvedTheme 넣으면 파괴 중 마커 setIcon 위험
  }, [activeSpot?.id]);

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

  // 스팟 포커스(0369) — 클릭한 좌표를 중심으로 부드럽게 이동(질감은 SPOT_TRANSITION 단일 소스).
  // 데스크톱(지도 422px): Math.max(현재줌, ZOOM_FOCUS) — 이미 더 확대해 둔 상태에서 클릭 시 축소되지 않게.
  // 모바일(0387): 지도가 풀스크린(0383)이라 ZOOM_FOCUS 확대가 너무 가깝다 → 현재 배율에서 한 단계 축소
  //   (getMinZoom 하한 클램프는 fitAllSpots와 동일 선례). isMobile로 가름 — 데스크톱 동작 무변.
  function focusSpot(spot: LocalSpot) {
    if (!mapInstance) return;
    const zoom = isMobile
      ? Math.max(mapInstance.getZoom() - 1, mapInstance.getMinZoom())
      : Math.max(mapInstance.getZoom(), ZOOM_FOCUS);
    mapInstance.morph(
      new naver.maps.LatLng(spot.lat, spot.lng),
      zoom,
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
  // 0396 ①: seq 가드 — 디바운스 자동검색은 늦게 보낸 요청이 먼저 올 수 있어, 최신 seq의 응답만 반영(옛 결과 덮기 방지).
  async function runSearch(raw: string) {
    const kw = raw.trim();
    if (kw.length < MIN_SEARCH_LEN) { // 2자 미만: 미발사 + 진행 중 응답 무효화
      searchSeqRef.current++;
      setSearchResults([]);
      setSearchStatus('idle');
      return;
    }
    const seq = ++searchSeqRef.current;
    setSearchStatus('loading'); // 왕복 중 로딩 표시(zero·error와 구분)
    const result = await searchPlaces(kw);
    if (seq !== searchSeqRef.current) return; // 스테일 응답 폐기
    if (result.status === 'ok') {
      setSearchResults(result.places);
      setSearchStatus('ok');
    } else {
      setSearchResults([]);
      setSearchStatus(result.status);
    }
  }

  // Enter·검색 버튼 — 대기 중 디바운스를 즉시 취소하고 곧장 검색(goal 1)
  function handleKeywordSearch() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    void runSearch(searchKeyword);
  }

  // 0396 ①: 입력 디바운스 자동검색 — 검색 모드에서 타이핑 멈춤 300ms 뒤 발사. 2자 미만은 0ms로 즉시 idle 정리.
  //   모든 setState는 타이머 콜백(runSearch) 안에서만 — effect 본문 동기 setState 회피(캐스케이드 렌더 방지).
  useEffect(() => {
    if (mode !== 'search') return;
    const kw = searchKeyword.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const delay = kw.length < MIN_SEARCH_LEN ? 0 : SEARCH_DEBOUNCE_MS; // 짧아지면 즉시 비우기
    searchDebounceRef.current = setTimeout(() => void runSearch(kw), delay);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchKeyword, mode]);

  async function handlePlaceSelect(place: PlaceResult) {
    const { lat, lng } = place; // x/y→lng/lat 변환은 서버 액션이 완료 — 클라엔 순수 숫자만
    const id = addSpot(place.name, lng, lat, place.address); // 0391: 검색 주소(도로명 우선)를 스팟에 실음
    // 0392: 교통을 이어서 수신. includeAddress=!place.address — place.address가 ''인 POI는 역지오코딩 폴백
    //   (false 고정이면 빈 주소 POI에서 폴백 소멸 — applySpotMeta의 `||` 병합과 짝).
    void fetchAndApplyMeta(id, lat, lng, !place.address);
    // 중심·줌 원자 전환(카카오 jump 상응) — setZoom+setCenter는 0ms 점프라 기각(SpotFinderMapNaver 실측)
    mapInstance?.morph(new naver.maps.LatLng(lat, lng), ZOOM_FOCUS, SPOT_TRANSITION);
    // 0394 ①: 항목 선택 = 검색 종료 — 결과·입력을 즉시 비우고 검색 모드 이탈(map 검색 오버레이 mode==='search' 해제).
    setSearchKeyword(''); setSearchResults([]); setSearchStatus('idle');
    setMode('edit');
    // localSpotsRef 최신 스팟에서 세팅(0395 메타 레이스 방지, addSpot가 place.address 실음).
    const setActive = () => setActiveSpot(localSpotsRef.current.find((s) => s.id === id) ?? { id, name: place.name, lat, lng, order: localSpots.length + 1, address: place.address });
    // 0396 ②: 찍기와 동형 — 모바일은 후보 조회 전에 시트 상승(대기는 nearbyPending이 덮음), 데스크톱은 조회 뒤(무변).
    if (isMobile) { setActive(); setNearbyPendingId(id); }
    // S3-a: 근처 기존 촬영지 후보 → chooser / 없으면 편집. 0384: try/catch 폴스루(위 addSpotFromMapRef 동일)
    let candidates: NearbySpot[] = [];
    try { candidates = await findNearbySpots(lat, lng); } catch { candidates = []; }
    setNearbyPendingId((prev) => (prev === id ? null : prev)); // 대기 종료
    const alive = localSpotsRef.current.some((s) => s.id === id); // 조회 중 취소·삭제 가드(유령 chooser 방지)
    if (!isMobile && alive) setActive();
    if (candidates.length > 0 && alive) setNearbyChooser({ spotId: id, candidates });
  }

  // 0391: address는 optional — 검색 경로가 place.address를 실어 작성 중 시트에 즉시 표시.
  //   찍기(addSpot('', …))·재사용은 미전달 = undefined(기존 동작). 저장 payload는 기존 지원(변경 불요).
  function addSpot(name: string, lng: number, lat: number, address?: string | null): string {
    const id = `tmp_${crypto.randomUUID()}`;
    const newSpot: LocalSpot = { id, name, lat, lng, order: localSpots.length + 1, address };
    const next = [...localSpots, newSpot];
    setLocalSpots(next);
    onSpotsChange?.(next);
    return id;
  }

  // 0392: 서버가 돌려준 주소·교통 4필드만 해당 스팟에 병합. 비동기 도착이라 localSpotsRef(최신)로 참조.
  function applySpotMeta(spotId: string, meta: SpotMeta) {
    const cur = localSpotsRef.current;
    const target = cur.find((s) => s.id === spotId);
    // 폐기 가드(삭제·재사용을 한자리에서):
    //  - 스팟이 그 사이 삭제됐으면 no-op(유령 스팟·에러 방지).
    //  - reusedSpotId가 붙었으면 no-op — 재사용은 공유 Spot 저장값이 정본(판단 ③). 찍기→getSpotMeta
    //    인플라이트 중 chooser에서 재사용을 고른 순서에서 역지오코딩 값이 정본을 덮는 것을 차단.
    if (!target || target.reusedSpotId) return;
    // address는 검색이 이미 실은 도로명(truthy)을 보존, 없거나 ''면 역지오코딩 폴백(|| — 빈문자열 falsy).
    const patch = (s: LocalSpot): LocalSpot => ({
      ...s,
      address: s.address || meta.address,
      nearestStation: meta.nearestStation,
      transitMinutes: meta.transitMinutes,
      transitMode: meta.transitMode,
    });
    const next = cur.map((s) => (s.id === spotId ? patch(s) : s));
    setLocalSpots(next);
    onSpotsChange?.(next);
    // 활성 시트가 이 스팟이면 함수형 패치로 갱신 — 사용자가 그동안 입력한 name/review/rating은 미손상
    //   (patch가 4필드만 덮고 나머지는 spread 보존). 다른 스팟이면 그대로.
    setActiveSpot((prev) => (prev && prev.id === spotId ? patch(prev) : prev));
  }

  // 0392: 좌표 한 왕복으로 메타 수신 후 병합. 실패는 무시(스팟은 이미 추가됨 — 주소·교통만 빔, goal 8).
  //   includeAddress=false = 검색 경로(place.address 도로명 이미 보유 → 역지오코딩 스킵, 쿼터 절약).
  async function fetchAndApplyMeta(spotId: string, lat: number, lng: number, includeAddress: boolean) {
    setMetaPendingIds((prev) => new Set(prev).add(spotId)); // 0395: 대기 시작 — 팝업이 "확인 중" 표시
    try {
      const meta = await getSpotMeta(lat, lng, { includeAddress });
      applySpotMeta(spotId, meta);
    } catch {
      /* 미인증·네트워크 실패 등 — 조용히 폐기(0178). 스팟 추가·저장은 무방해 */
    } finally {
      // 0395: 값 도착·null 확정·실패 모두 대기 종료 — "확인 중" 제거(영구 표시 금지, goal 3·4)
      setMetaPendingIds((prev) => {
        if (!prev.has(spotId)) return prev;
        const next = new Set(prev);
        next.delete(spotId);
        return next;
      });
    }
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
            // 0392: 재사용 = 공유 Spot 저장값이 정본 → nearby select로 받은 주소·교통을 그대로 표시
            //   (getSpotMeta 재계산 아님 — 중복·drift 회피, 판단 ⑤). 검색 주소(도로명)는 후보값으로 대체.
            address: candidate.address,
            nearestStation: candidate.nearestStation,
            transitMinutes: candidate.transitMinutes,
            transitMode: candidate.transitMode,
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
  // 0386: sheetSpot = 모바일 시트 전용 오버라이드 — 닫힘 애니 중 activeSpot이 이미 null이어도
  // closingSpot 스냅샷으로 콘텐츠를 그려 빈 시트가 내려가지 않게. 미전달(데스크톱/카드 슬롯)은
  // 기존대로 activeSpot/displayedSpot — 완전 무변. key=s.id라 닫힘 중 같은 id면 인스턴스 보존(편집상태 flash 없음).
  function renderPopup(sheetSpot?: LocalSpot) {
    if (readOnly) {
      const s = sheetSpot ?? displayedSpot;
      return s ? (
        <SpotPopup
          key={s.id}
          spot={s}
          readOnly
          closeHandleRef={closeHandleRef}
          onClose={handlePopupClose}
        />
      ) : null;
    }
    const s = sheetSpot ?? activeSpot;
    return s ? (
      <SpotPopup
        key={s.id}
        spot={s}
        readOnly={!canAddSpot}
        closeHandleRef={closeHandleRef}
        onDelete={canAddSpot ? () => handleDelete(s.id) : undefined}
        onClose={handlePopupClose}
        onUpdate={handleSpotUpdate}
        onFileSelect={(file) => onPhotoSelect?.(s.id, file)}
        initialEditing={mode === 'edit'}
        metaPending={metaPendingIds.has(s.id)} // 0395: 주소·교통 조회 중이면 "확인 중" 표시(값 없을 때만)
        autoFocusName={!isMobile} // 0397: 모바일은 이름 자동 포커스 안 함(키보드가 지도 가림) — 검색·찍기 공통
      />
    ) : null;
  }

  // 0394: chooser 1벌 정의 — 데스크톱 사이드 카드 슬롯과 모바일 시트 슬롯이 공유(0378 renderPopup과 대칭).
  //   카드 크롬(bg-card·rounded·border·overflow)은 슬롯이 제공, 여기선 내부 콘텐츠(p-5)만.
  // 0396 ②: 후보 조회 중 시트 대기 콘텐츠 — 0395 metaPending과 같은 결(muted·animate-pulse "확인 중").
  //   편집 폼을 먼저 보였다 chooser로 바꾸는 flash 방지. 시트 상승 애니(320ms)가 빠른 조회를 덮어 보통은 비가시.
  function renderNearbyPending() {
    return (
      <div className="p-5 flex items-center justify-center min-h-[140px]">
        <p className="text-sm text-muted animate-pulse">확인 중…</p>
      </div>
    );
  }

  function renderChooser() {
    if (!nearbyChooser) return null;
    return (
      <div className="p-5 flex flex-col gap-3">
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
                className="w-full text-left rounded-lg border border-border hover:bg-popover px-3 py-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium text-fg truncate">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted">{c.distanceM}m</span>
                </div>
                {c.movies.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.movies.map((m) => (
                      <span key={m} className="rounded-full bg-surface2 border border-border text-fg2 text-xs px-2 py-0.5">{m}</span>
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
    );
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
            모달 z 상향(>10000)안은 SDK 내부 상수와의 경쟁이라 기각. isolate는 풀스크린에서도 유지. */}
        {/* 0383: sheetOpen 동안 fixed 풀스크린(z-55 < 시트 60) — 구글지도·Turo 표준(지도 풀스크린 +
            시트 오버레이 + padding.bottom 보정). 같은 DOM 노드 클래스 토글이라 지도 재init·이동 없음
            (0328 getLayer 크래시 경로 회피). sheetOpen=isMobile 전제라 else 분기(flow 카드)가 데스크톱
            상시 = 무변. 풀스크린은 직각(rounded 미부여). 크기 변화 relayout은 Effect B가 선점 처리. */}
        <div className={`isolate overflow-hidden ${sheetOpen ? 'fixed inset-0 z-[55]' : 'relative md:flex-1 h-[400px] md:h-[500px] rounded-xl'}`}>
          {/* 리뷰장소 전체보기 오버레이(0369) — 확대해 돌아다닌 뒤 전체 뷰 복귀. 글쓰기·상세 공용
              (초기 뷰가 양쪽 적용이므로 복귀 수단도 양쪽). z-10 = 지도 위·팝오버(z-50) 아래.
              우상단 = 네이버 기본 컨트롤(로고·저작권·축척, 하단 계열)과 비충돌 — 실화면 확인 항목.
              모양: 알약(pill) + 아이콘 — 지도 위 부유 컨트롤 관례. 데스크톱은 컴팩트(sm:py-1.5),
              모바일만 min-h 44px 터치 타깃 유지(§5 — 축소 요구와 기준선의 양립은 반응형으로).
              text-xs(12px) = §5 하한 준수. 토큰만 사용(다크 자동). smooth=true — 사용자 조작은 morph.
              !sheetOpen(0387) — 시트(좌표 1개 리뷰) 중엔 "전체보기"가 맥락에 안 맞고 작은 화면에 안 담김.
              sheetOpen은 closingSpot 포함이라 닫힘 애니(240ms) 중에도 true → 버튼이 미리 깜빡이지 않음.
              데스크톱은 sheetOpen never true(isMobile 전제)라 상시 표시 = 무변. */}
          {localSpots.length > 0 && !sheetOpen && (
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
          {/* 0386→0388: fullscreen↔카드 전환 커버(0370과 별개 오버레이 — semantics 상이). opacity·transition
              지속을 cover state가 함께 구동: 열기-인 ms:0(즉시 opaque, 플립·stretched 프레임 가림) /
              열기-아웃 SHEET_OPEN_COVER_OUT_MS / 닫기-인 SHEET_CLOSE_MS(하강 동기 페이드-인) / 닫기-아웃·인터럽트정리 SHEET_COVER_OUT_MS.
              reduced-motion은 cover 미설정이라 상시 {0,0}(즉시 노출). 래퍼 내부라 다크서 교체 프레임 카드 바깥
              페이지 노출은 구조적 — 실기기 다크 확인 항목(래퍼 밖 이동은 이번 제약 밖). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 bg-card"
            style={{
              opacity: cover.opacity,
              transition: cover.ms ? `opacity ${cover.ms}ms cubic-bezier(0.25,0.1,0.25,1)` : 'none',
            }}
          />
          {/* 명령형 지도 마운트 지점 — 마커·폴리라인은 effect로 부착(② 단계), 선언형 자식 없음 */}
          <div ref={mapDivRef} className="w-full h-full" />
          {mode === 'search' && (
            <div className="absolute inset-x-3 top-3 z-20">
              <div className="bg-card rounded-xl shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Search size={14} className="text-muted shrink-0" />
                  {/* 0394: 모바일 16px(iOS 자동 확대 방지 §5) / sm↑ 14px — 0341 태그 input 선례 */}
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleKeywordSearch(); }}
                    placeholder="예) 광화문, 서울시청"
                    autoFocus
                    className="flex-1 text-base sm:text-sm text-fg focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleKeywordSearch}
                    className="text-xs text-muted hover:text-fg px-2 transition-colors"
                  >
                    검색
                  </button>
                </div>
                {searchStatus === 'loading' && (
                  <div className="border-t border-border px-3 py-3">
                    {/* 0396: 왕복 중 로딩 — 0395 "확인 중" 어휘와 같은 결(muted·animate-pulse) */}
                    <p className="text-sm text-muted animate-pulse">검색 중…</p>
                  </div>
                )}
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
            내부 카드의 기존 overflow-y-auto가 영구 미발동(실측 확정). 모바일은 무상한(스택+모달)
            rounded-xl(0455) — 카드 하단 경계가 이 슬롯의 클립선과 정확히 겹치는 구조(위 500 파생)라
            직각 클립이 서브픽셀 반올림에서 카드 하단 노치를 깎음(실화면: 위 둥긂·아래 직각).
            클립 자체를 내부 카드들과 같은 곡률로 — 내부 카드 전원이 rounded-xl이라 전 모드 무해 */}
        <div className={`overflow-hidden rounded-xl flex-shrink-0 md:max-h-[500px] transition-all duration-200 ${(canAddSpot || activeSpot || readOnly) ? `${fixedSideWidth ? SIDE_CARD_WIDTH : 'w-full md:w-2/5'} opacity-100` : 'w-0 opacity-0 pointer-events-none'
          }`}>
          {readOnly ? (
            <div className="bg-surface2 rounded-xl shadow-lg h-full p-5 relative overflow-hidden">
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
              {/* 0377: bg-surface2 — 모바일에서 목록이 flow에 남으므로(위) 팝업 레이어가 투명하면 겹쳐 보임.
                  md 크로스페이드에도 무해(같은 카드면 위 불투명 층) — 카드 프레임(위 1208)과 동색 유지 필수 */}
              <div className={`absolute inset-0 rounded-xl bg-surface2 transition-opacity duration-200 overflow-y-auto ${activeSpot ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {/* !isMobile — 모바일 팝업은 아래 전체화면 모달 슬롯(0378). 빈 레이어는 모달 뒤라 비가시 */}
                {!isMobile && renderPopup()}
              </div>
            </div>
          ) : nearbyChooser ? (
            // 0394: 데스크톱 사이드 카드 슬롯 — 카드 크롬은 여기, 콘텐츠는 renderChooser 공유(모바일 시트와 동일 소스)
            <div className="bg-surface2 rounded-xl shadow-lg h-full overflow-y-auto">
              {renderChooser()}
            </div>
          ) : activeSpot && !isMobile ? (
            // !isMobile(0378) — 모바일 팝업은 아래 전체화면 모달 슬롯. 카드는 메뉴로 폴스루(닫힘 후 상태와 동일)
            <div className="bg-surface2 rounded-xl shadow-lg h-full overflow-y-auto">
              {renderPopup()}
            </div>
          ) : canAddSpot ? (
            // 면 = bg-surface2·무테두리(0459) — readOnly 분기(위 1211)와 동일 어휘로 읽기·편집 카드면 동조.
            // 세 크롬(chooser·popup·menu) 동시 전환 — 한 곳만 바꾸면 상태 전환마다 카드 색이 튐
            <div className="bg-surface2 rounded-xl shadow-lg h-full p-5 flex flex-col gap-4">
              {mode === 'pinning' ? (
                <>
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <MapPin size={40} className="text-muted" />
                    <p className="text-sm text-muted text-center">지도를 클릭해 위치를 지정하세요</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('menu')}
                    className="flex items-center gap-1.5 text-xs text-fg2 bg-surface2 border border-border hover:bg-popover px-3 py-1.5 rounded-lg w-fit transition-colors"
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
                    className="flex items-center gap-1.5 text-xs text-fg2 bg-surface2 border border-border hover:bg-popover px-3 py-1.5 rounded-lg w-fit transition-colors"
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
                    className="flex items-center gap-1.5 text-xs text-fg2 bg-surface2 border border-border hover:bg-popover px-3 py-1.5 rounded-lg w-fit transition-colors"
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
                      // hover popover(0460) — 카드면 surface2에서 hover:bg-surface2는 Δ0(무반응). 메뉴 행 3개 공통
                      className="flex items-center gap-3 p-3 rounded-lg border border-border text-left w-full hover:bg-popover transition-colors"
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
                      className="flex items-center gap-3 p-3 rounded-lg border border-border text-left w-full hover:bg-popover transition-colors"
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
                        ? 'border-border hover:bg-popover'
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
          스크롤러: 명시 h-full(flex-grow 금지 §5·0253) + overscroll-none(스크롤 락 페어) +
          pb 88+env = 탭바 pill이 시트 위에 그려지는 기존 스태킹 사항 보정(SpotFinder :326 관례).
          overflow-hidden = 상단 radius 클립. */}
      {/* 0386: 마운트 조건에 closingSpot 포함 — 닫힘 애니 동안 시트를 살려둔다.
          0387: 슬라이드는 WAAPI(위 useLayoutEffect의 el.animate)가 구동 — 인라인 animation·onAnimationEnd
          제거. sheetClosing이면 pointer-events-none(내려가는 시트 오조작 차단, goal 5). */}
      {isMobile && (activeSpot || closingSpot) && (
        <div
          ref={sheetRef}
          className={`md:hidden fixed inset-x-0 bottom-0 z-[60] h-[max(70svh,calc(420px+env(safe-area-inset-bottom)))] bg-card rounded-t-[22px] border border-border shadow-2xl overflow-hidden ${sheetClosing ? 'pointer-events-none' : ''}`}
        >
          {/* 0383: pb 88(탭바 pill 겹침) 보정 제거 — 시트(z-60)가 탭바(z-40)를 덮으므로 불요.
              base 16 = §5 가장자리 여백(저장·취소 버튼이 화면 끝/홈바에 붙지 않게, env=0 기기 포함)
              + 홈 인디케이터 safe-area. overscroll-none(0388) = 뒤로 새는 것 차단(contain 상위) +
              iOS 고무줄 바운스 억제 — contain은 체이닝만 막고 자기 바운스는 허용해 시트 상단 빈 띠가
              드러났음(실기기 ~170px 회색 띠). h-full이라 스크롤러=시트 동일 높이(높이 계산 무결).
              키보드 열림 시 저장 버튼 도달성은 별건(0384 visualViewport) */}
          <div className="h-full overflow-y-auto overscroll-none pb-[calc(16px+env(safe-area-inset-bottom))]">
            {/* 0394: chooser 활성이면 시트에 chooser, 아니면 편집/보기 팝업. 선택 후 nearbyChooser=null →
                같은 시트가 편집 폼으로 전환(activeSpot·시트 유지라 재애니 없음). */}
            {/* 0396 ②: chooser > 대기(후보 조회 중, 현재 시트 스팟에 한함) > 편집/보기 팝업. 대기는 flash 방지용. */}
            {nearbyChooser
              ? renderChooser()
              : (nearbyPendingId && nearbyPendingId === activeSpot?.id)
                ? renderNearbyPending()
                : renderPopup(activeSpot ?? closingSpot ?? undefined)}
          </div>
        </div>
      )}
    </div>
  );
}
