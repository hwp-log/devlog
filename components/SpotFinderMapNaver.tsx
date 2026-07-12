'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { SpotFinderSpot } from '@/lib/spot/queries';
import { theme, withAlpha } from '@/lib/theme';
import { useNaverMapsLoader } from '@/lib/naver/useNaverMapsLoader';
import { getMarkerClusteringClass, type MarkerClusteringInstance } from '@/lib/naver/MarkerClustering';

const PRIMARY = theme.common.primary;

// 국내 전용 지도 — 제주·독도 포함 한국 bbox (판단값, "국내만 제공" 배너와 정합)
const KOREA_BOUNDS = { south: 32.5, west: 123.5, north: 39.5, east: 132.5 };

// 마커 본체 크기 상수 — anchor 파생 계산의 단일 소스 (라벨 높이는 translate -100%가 자동 흡수)
const MARKER_DOT_SIZE = 11; // 미선택 점 (border-box)
const MARKER_CARD_SIZE = 58; // 선택 썸네일 카드 (border-box)

// HTML 문자열 아이콘에 들어가는 사용자 데이터 최소 이스케이프
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 마커 HTML — 시안 2단계: 미선택 = 지명 라벨 pill + 11px 점 / 선택 = 58px 썸네일 카드 + primary pill.
// 0-크기 외곽 + translate(-50%,-100%)로 "블록 하단 중앙 = 좌표" (시안 앵커 동일, 라벨 가변 폭 대응 — anchor는 Point(0,0))
// 라벨 12px = CLAUDE.md §5 하한 준수 (시안 11px, 기존 눈썹·배지 판정 계열). 색은 토큰(var(--surface2)/var(--fg2)/var(--bg))
function markerContent(spot: SpotFinderSpot, selected: boolean): string {
  const name = escapeHtml(spot.name);
  const pillBase = 'font-size:12px;padding:3px 9px;border-radius:999px;white-space:nowrap;display:inline-block;position:relative;margin-bottom:4px;';
  const pingAnim = `animation:spot-ping 1.8s cubic-bezier(0,0,0.2,1) infinite`;

  // 스택형 구조 (선택 = 미선택 + 추가 레이어): [카드(선택+사진)] / [라벨] / [점 — 항상 좌표에 고정].
  // 점이 살아 있으므로 발광(이중 링 + 핑)은 항상 점에서 발생 — 카드에 가려질 일이 없음 (radial 불필요).
  // 간격은 시안 준용: 카드-라벨 4px(시안 카드 margin-bottom) / 라벨-점 4px(시안 미선택 간격)
  const dotShadow = selected
    ? `0 0 0 6px ${withAlpha(PRIMARY, 0.15)}, 0 0 0 12px ${withAlpha(PRIMARY, 0.08)}, 0 2px 6px rgba(0,0,0,0.5)`
    : '0 2px 6px rgba(0,0,0,0.5)';
  const pillColor = selected
    ? `background:${PRIMARY};color:#fff;border:1px solid ${PRIMARY}`
    : 'background:var(--surface2);color:var(--fg2);border:1px solid rgba(255,255,255,0.12)';
  const ping = selected
    ? `<span style="position:absolute;left:50%;bottom:${-(41 - MARKER_DOT_SIZE / 2)}px;width:82px;height:82px;margin-left:-41px;border-radius:50%;background:${withAlpha(PRIMARY, 0.75)};pointer-events:none;${pingAnim}"></span>`
    : '';
  const card = selected && spot.photoUrl
    ? `<span style="display:block;width:${MARKER_CARD_SIZE}px;height:${MARKER_CARD_SIZE}px;border-radius:14px;border:2.5px solid #fff;box-shadow:0 8px 24px rgba(0,0,0,0.55);margin:0 auto 4px;background-image:url('${escapeHtml(spot.photoUrl)}');background-size:cover;background-position:center;position:relative"></span>`
    : '';
  const inner = `${ping}
      ${card}
      <span style="${pillBase}${pillColor}">${name}</span>
      <span style="display:block;width:${MARKER_DOT_SIZE}px;height:${MARKER_DOT_SIZE}px;border-radius:50%;border:2px solid var(--bg);box-shadow:${dotShadow};background:${PRIMARY};position:relative"></span>`;

  // 점 중심 = 좌표 (항상): translate -100%(묶음 전체 — 카드·라벨 높이 자동 흡수) + 점높이/2 하향 보정.
  // 선택 토글 시 점·라벨은 제자리 고정, 카드만 라벨 위에 나타났다 사라진다. 미선택 총높이 ≈ 47px ≥ 44px (§5 히트 타겟)
  return `<div style="position:relative;width:0;height:0">
    <div style="position:absolute;left:0;top:0;transform:translate(-50%, calc(-100% + ${MARKER_DOT_SIZE / 2}px));display:flex;flex-direction:column;align-items:center;min-width:44px;padding:6px 8px 0;cursor:pointer">${inner}</div>
  </div>`;
}

// 클러스터 원: 카카오 CLUSTER_STYLES 동등 값 — 44px 터치 타겟, primary 채움(+흰 글자)
function clusterIconContent(): string {
  return `<div style="width:44px;height:44px;border-radius:9999px;background:${PRIMARY};border:2px solid #fff;color:#fff;font-size:12px;font-weight:600;text-align:center;line-height:40px;cursor:pointer;box-shadow:0 0 0 6px ${withAlpha(PRIMARY, 0.15)}">1</div>`;
}

// naver LatLngBounds는 빈 생성자가 없어 첫 좌표로 시드 (카카오와 다름)
function buildBounds(spots: SpotFinderSpot[]): naver.maps.LatLngBounds {
  const first = new naver.maps.LatLng(spots[0].lat, spots[0].lng);
  const bounds = new naver.maps.LatLngBounds(first, first);
  spots.forEach((s) => bounds.extend(new naver.maps.LatLng(s.lat, s.lng)));
  return bounds;
}

// 단일 스팟의 퇴화 bounds(면적 0)는 GL fitBounds가 무시함(실측) — setCenter+setZoom 분기
const SINGLE_SPOT_ZOOM = 14; // 동네 스케일 (카카오 setBounds 단일점 결과와 유사)
function fitMapToSpots(map: naver.maps.Map, spots: SpotFinderSpot[]) {
  if (spots.length === 1) {
    // 순서 중요: 줌인 먼저 — 광역 줌에서 setCenter를 먼저 하면 maxBounds가 뷰포트를
    // 클램프해 중심이 엉뚱한 곳으로 밀린 채 줌인된다 (실측)
    map.setZoom(SINGLE_SPOT_ZOOM);
    map.setCenter(new naver.maps.LatLng(spots[0].lat, spots[0].lng));
    return;
  }
  map.fitBounds(buildBounds(spots), { top: 110, right: 40, bottom: 40, left: 40 });
}

type Props = { spots: SpotFinderSpot[] };

// 상세 콘텐츠 단일 정의 — 모바일 플로팅 카드와 데탑 우측 고정 패널이 공유 (내용·순서 동일)
function SpotDetailContent({ spot, onClose }: { spot: SpotFinderSpot; onClose: () => void }) {
  return (
    <>
      <div className="relative h-[210px] flex-shrink-0">
        {spot.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spot.photoUrl} alt={spot.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface2 flex items-center justify-center">
            <span className="text-muted text-sm">No Image</span>
          </div>
        )}
        {/* 시안 실측 스크림 — 하단 제목 가독 + 상단 X 대비. No Image 폴백에도 동일 적용해 흰 제목 가독 보장 */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(13,13,20,0.85)_0%,rgba(13,13,20,0.15)_45%,rgba(13,13,20,0.35)_100%)]"
        />
        {/* 작품 배지 — 시안 실측 top12/left14, 중립 오버레이 배경(작품색 매핑 부재로 기판정 제외) */}
        <div className="absolute top-3 left-3.5 flex">
          <span className="rounded-full bg-white/[0.18] px-[7px] py-[2px] text-xs font-normal text-white whitespace-nowrap">
            {spot.movie.title}
          </span>
        </div>
        <div className="absolute left-4 right-4 bottom-[14px]">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] leading-[1.3] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.60)]">
            {spot.name}
          </h2>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-card/80 hover:bg-card flex items-center justify-center flex-shrink-0 transition-colors text-fg shadow-sm"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-muted mb-1">촬영지 리뷰</p>
          {spot.review ? (
            <p className="text-sm text-fg2 whitespace-pre-wrap">{spot.review}</p>
          ) : (
            <p className="text-sm text-muted">리뷰 없음</p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted mb-2">출처</p>
          <div className="flex items-center gap-2">
            {spot.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spot.author.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-fg text-bg text-xs font-semibold flex items-center justify-center flex-shrink-0">
                {spot.author.nickname[0]}
              </div>
            )}
            <span className="text-sm text-fg2">{spot.author.nickname}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SpotFinderMapNaver({ spots }: Props) {
  const { ready, error } = useNaverMapsLoader();

  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<naver.maps.Map | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<SpotFinderSpot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArrows, setShowArrows] = useState(false);
  const chipBarRef = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const userInteractedRef = useRef(false);
  const lastSizeRef = useRef({ w: 0, h: 0 });
  // 명령형 마커 관리 — 마커 리빌드 없이 최신 선택/핸들러 참조 유지
  const markersRef = useRef(new Map<string, naver.maps.Marker>());
  const clustererRef = useRef<MarkerClusteringInstance | null>(null);
  const selectedSpotRef = useRef<SpotFinderSpot | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);
  const handleSpotSelectRef = useRef<(s: SpotFinderSpot) => void>(() => {});

  // 렌더 중 ref 쓰기 금지(react-hooks 규칙) — 커밋 후 동기화. 마커 effect보다 먼저 선언되어 같은 커밋 내 선행 실행
  useEffect(() => {
    selectedSpotRef.current = selectedSpot;
  }, [selectedSpot]);

  // 작품별 그룹핑 — JS 내장 Map과 지도 컴포넌트 Map 이름 충돌 방지
  const movieGroups = useMemo(() => {
    const acc = spots.reduce<Record<string, { title: string; count: number }>>((rec, s) => {
      if (rec[s.movie.id]) rec[s.movie.id].count++;
      else rec[s.movie.id] = { title: s.movie.title, count: 1 };
      return rec;
    }, {});
    return Object.entries(acc).map(([id, v]) => ({ id, ...v }));
  }, [spots]);

  const filteredMovieGroups = useMemo(() => {
    if (!searchQuery.trim()) return movieGroups;
    const q = searchQuery.toLowerCase();
    return movieGroups.filter((g) => g.title.toLowerCase().includes(q));
  }, [movieGroups, searchQuery]);

  const visibleSpots = useMemo(
    () => selectedMovieId
      ? spots.filter((s) => s.movie.id === selectedMovieId)
      : spots,
    [spots, selectedMovieId]
  );

  // 지도 생성 — 명령형 init/destroy (StrictMode 이중 마운트 안전, GL 컨텍스트 해제)
  useEffect(() => {
    if (!ready || !mapDivRef.current) return;
    // WebGL 미지원 환경(구형 기기·차단·일부 헤드리스): 래스터 폴백 — 커스텀 스타일만 미적용, 기능 동일
    const supportsGl = !!document.createElement('canvas').getContext('webgl');
    if (!supportsGl) console.warn('[SpotFinderMapNaver] WebGL 미지원 — 래스터 폴백 (커스텀 스타일 미적용)');
    const map = new naver.maps.Map(mapDivRef.current, {
      center: new naver.maps.LatLng(36.5, 127.8),
      zoom: 7, // 카카오 level 13 상응 — 마운트 직후 fitBounds가 덮으므로 코스메틱
      minZoom: 6,
      maxBounds: new naver.maps.LatLngBounds(
        new naver.maps.LatLng(KOREA_BOUNDS.south, KOREA_BOUNDS.west),
        new naver.maps.LatLng(KOREA_BOUNDS.north, KOREA_BOUNDS.east),
      ),
      // customStyleId는 GL(벡터) 전용. STYLE_VERSION env는 JS SDK에 대응 옵션이 없음 —
      // Style Editor 배포 버전이 자동 반영되므로 미소비 (발명 금지)
      ...(supportsGl
        ? { gl: true, customStyleId: process.env.NEXT_PUBLIC_NAVER_MAP_STYLE_ID }
        : {}),
    });
    // GL 지도는 비동기 초기화 — init 전에 fitBounds/클러스터러를 붙이면 빈 bounds로
    // 계산되어 마커가 그려지지 않는다 (실측). init 이벤트 후 인스턴스 공개.
    const initListener = naver.maps.Event.once(map, 'init', () => setMapInstance(map));
    return () => {
      naver.maps.Event.removeListener(initListener);
      setMapInstance(null);
      map.destroy();
    };
  }, [ready]);

  // 마커·클러스터 구축 — visibleSpots 변경 시 파괴·재생성 (공식 유틸에 setMarkers 없음).
  // 칩 fitBounds effect보다 먼저 선언 필수: 애니메이션 시작 후 오버레이 대량 탈부착이 겹치면 GL 지도 이동이 동결됨 (실측)
  useEffect(() => {
    if (!mapInstance) return;
    const MarkerClustering = getMarkerClusteringClass();
    const markerIndex = markersRef.current; // 클린업 시점 ref 재조회 경고 회피 — 같은 Map 인스턴스 캡처
    const markers = visibleSpots.map((spot) => {
      const selected = selectedSpotRef.current?.id === spot.id;
      const marker = new naver.maps.Marker({
        // map 미지정 — 클러스터러가 클러스터 상태에 따라 부착/해제를 관리
        position: new naver.maps.LatLng(spot.lat, spot.lng),
        // 0-크기 콘텐츠 + 내부 translate(-50%,-100%) 구조라 anchor는 (0,0) — 하단 중앙 = 좌표
        icon: { content: markerContent(spot, selected), anchor: new naver.maps.Point(0, 0) },
        zIndex: selected ? 10 : 1,
      });
      naver.maps.Event.addListener(marker, 'click', () => handleSpotSelectRef.current(spot));
      markerIndex.set(spot.id, marker);
      return marker;
    });
    const clusterer = new MarkerClustering({
      map: mapInstance,
      markers,
      averageCenter: true,
      minClusterSize: 1,
      maxZoom: 11, // 카카오 minLevel 10 상응 (zoom ≈ 20 − level) — 경계감은 검증 때 튜닝
      gridSize: 120,
      disableClickZoom: false,
      icons: [{ content: clusterIconContent(), size: new naver.maps.Size(44, 44), anchor: new naver.maps.Point(22, 22) }],
      indexGenerator: [Infinity], // 단일 아이콘 — 카카오 CLUSTER_STYLES 1개와 동일
      stylingFunction: (clusterMarker, count) => {
        const root = (clusterMarker as unknown as { getElement(): HTMLElement | null }).getElement();
        const el = root?.querySelector('div');
        if (el) el.textContent = String(count);
      },
    });
    clustererRef.current = clusterer;
    return () => {
      // 순서 중요: 클러스터러 먼저 해제 — 역순이면 idle 재그리기가 유령 마커를 재부착
      clusterer.setMap(null);
      markers.forEach((m) => m.setMap(null));
      markerIndex.clear();
      clustererRef.current = null;
    };
  }, [mapInstance, visibleSpots]);

  // 선택 변경 — 전체 리빌드 대신 prev/next 두 마커만 아이콘 교체 (클러스터 플리커 방지, setIcon=DOM 교체라 핑 재시작 보장)
  useEffect(() => {
    const prevId = prevSelectedIdRef.current;
    if (prevId && prevId !== selectedSpot?.id) {
      const prev = markersRef.current.get(prevId);
      const prevSpot = spots.find((s) => s.id === prevId);
      if (prev && prevSpot) {
        prev.setIcon({ content: markerContent(prevSpot, false), anchor: new naver.maps.Point(0, 0) });
        prev.setZIndex(1);
      }
    }
    if (selectedSpot) {
      const next = markersRef.current.get(selectedSpot.id);
      if (next) {
        next.setIcon({ content: markerContent(selectedSpot, true), anchor: new naver.maps.Point(0, 0) });
        next.setZIndex(10);
      }
    }
    prevSelectedIdRef.current = selectedSpot?.id ?? null;
  }, [selectedSpot, spots]);


  // 칩 클릭 시 자동 줌 — visibleSpots 대신 selectedMovieId 의존으로 무한루프 방지
  useEffect(() => {
    if (!mapInstance || visibleSpots.length === 0) return;
    fitMapToSpots(mapInstance, visibleSpots);
  }, [selectedMovieId, mapInstance]);

  // 사용자 조작 감지 — 순수 제스처만 신뢰 (dragstart/pinchstart/dblclick + DOM wheel).
  // 카카오 zoom_start 대응인 zoom_changed는 애니메이션 fitBounds 중에도 계속 발화해
  // 시간창 가드로도 오탐이 남는다 (실측: 초기 fit 애니메이션이 사용자 조작으로 오인됨)
  useEffect(() => {
    if (!mapInstance) return;
    const markInteracted = () => { userInteractedRef.current = true; };
    // removeListener는 핸들 기반 — 카카오식 (target, type, fn) 해제는 조용히 누수
    const listeners = [
      naver.maps.Event.addListener(mapInstance, 'dragstart', markInteracted),
      naver.maps.Event.addListener(mapInstance, 'pinchstart', markInteracted),
      naver.maps.Event.addListener(mapInstance, 'dblclick', markInteracted),
    ];
    const el = mapDivRef.current;
    el?.addEventListener('wheel', markInteracted, { passive: true });
    return () => {
      listeners.forEach((l) => naver.maps.Event.removeListener(l));
      el?.removeEventListener('wheel', markInteracted);
    };
  }, [mapInstance]);

  // 칩 바 넘침 감지 — 폰트 스왑 후 재측정 포함(Pretendard 로드 완료 시)
  useEffect(() => {
    const el = chipBarRef.current;
    if (!el) return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      setShowArrows(el.scrollWidth > el.clientWidth);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    document.fonts?.ready?.then(check);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [filteredMovieGroups, ready]);

  // 컨테이너 크기 변경 시: 항상 relayout, 사용자 조작 전이면 bounds 재적합 / 이후면 center 보존
  useEffect(() => {
    const el = mapWrapperRef.current;
    if (!el || !mapInstance) return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      // 재-observe 즉발 콜백 가드: visibleSpots 변경으로 effect가 재실행되면 observe가
      // 즉시 콜백을 발화하는데, 크기 불변이면 무시 — 진행 중인 fit 애니메이션에
      // autoResize/setCenter가 끼어들어 지도 이동이 동결되는 충돌 방지 (실측)
      const { width, height } = el.getBoundingClientRect();
      if (width === lastSizeRef.current.w && height === lastSizeRef.current.h) return;
      lastSizeRef.current = { w: width, h: height };
      frame = requestAnimationFrame(() => {
        const center = mapInstance.getCenter();
        mapInstance.autoResize(); // 카카오 relayout() 상응
        if (!userInteractedRef.current && visibleSpots.length > 0) {
          fitMapToSpots(mapInstance, visibleSpots);
        } else {
          mapInstance.setCenter(center);
        }
      });
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mapInstance, visibleSpots]);

  function scrollChips(dir: 'left' | 'right') {
    chipBarRef.current?.scrollBy({ left: dir === 'right' ? 150 : -150, behavior: 'smooth' });
  }

  // 스팟 선택 단일 정의 — 마커·좌측 리스트가 공유 (규율 5)
  function handleSpotSelect(spot: SpotFinderSpot) {
    setSelectedSpot(spot);
    mapInstance?.panTo(new naver.maps.LatLng(spot.lat, spot.lng));
  }

  // 마커 클릭 리스너의 스테일 클로저 방지 — 매 커밋 최신 핸들러 동기화 (렌더 중 ref 쓰기 금지 규칙 준수)
  useEffect(() => {
    handleSpotSelectRef.current = handleSpotSelect;
  });

  if (error) {
    return (
      <div className="w-full h-full bg-card flex items-center justify-center p-6 text-center">
        <p className="text-sm text-muted">지도를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      </div>
    );
  }
  if (!ready) return <div className="w-full h-full bg-card animate-pulse" />;

  return (
    <div ref={mapWrapperRef} className="relative w-full h-full flex">
      {/* 좌측 칼럼 — 모바일: 지도 위 플로팅(absolute) / md: 320px 정적 열 (같은 DOM, 클래스 전환) */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col gap-2 md:static md:top-auto md:left-auto md:right-auto md:z-auto md:w-[320px] md:shrink-0 md:h-full md:bg-bg md:border-r md:border-border md:p-3">
        {/* 데탑 전용 헤더 — 시안 실측 18/20/10, 칼럼 md:p-3(12)+gap-2(8) 보정. 눈썹은 하한 준수 12px(시안 11px) */}
        <div className="hidden md:block pt-1.5 px-2 pb-0.5">
          <p className="text-xs font-normal tracking-widest text-primary">SpotFinder</p>
          <h1 className="mt-1 text-base font-semibold tracking-[-0.02em] text-fg break-keep">
            영화·드라마 촬영지 검색
          </h1>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="드라마·영화 검색"
          className="w-full rounded-xl px-4 py-2 text-sm border border-border bg-card text-fg placeholder:text-muted focus:outline-none focus:border-slate-400 shadow-sm"
        />

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm px-2 py-1.5">
          {showArrows && (
            <button
              type="button"
              aria-label="이전"
              onClick={() => scrollChips('left')}
              className="hidden md:flex shrink-0 w-7 h-7 rounded-full bg-card text-fg items-center justify-center shadow-sm hover:bg-surface2 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          <div ref={chipBarRef} className="flex-1 flex gap-2 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setSelectedMovieId(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                selectedMovieId === null
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-fg2 border-border'
              }`}
            >
              전체 ({spots.length})
            </button>
            {filteredMovieGroups.map((g) => (
              <button
                type="button"
                key={g.id}
                onClick={() => setSelectedMovieId(g.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                  selectedMovieId === g.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-fg2 border-border'
                }`}
              >
                {g.title} ({g.count})
              </button>
            ))}
          </div>
          {showArrows && (
            <button
              type="button"
              aria-label="다음"
              onClick={() => scrollChips('right')}
              className="hidden md:flex shrink-0 w-7 h-7 rounded-full bg-card text-fg items-center justify-center shadow-sm hover:bg-surface2 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {selectedSpot && (
          <div className="md:hidden bg-card rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[calc(100vh-160px)]">
            <SpotDetailContent spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
          </div>
        )}

        {/* 스팟 리스트 (md 전용) — 시안 실측 구성: 썸네일 48 + 이름 + 배지 (메타줄은 데이터 부재로 생략) */}
        <ul className="hidden md:flex flex-col gap-[7px] flex-1 overflow-y-auto min-h-0">
          {visibleSpots.map((spot) => {
            const selected = selectedSpot?.id === spot.id;
            return (
              <li key={spot.id}>
                <button
                  type="button"
                  onClick={() => handleSpotSelect(spot)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/[0.08]'
                      : 'border-transparent hover:bg-card'
                  }`}
                >
                  {spot.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spot.photoUrl}
                      alt=""
                      className="w-12 h-12 rounded-[10px] object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-[10px] bg-surface2 shrink-0" />
                  )}
                  <div className="min-w-0 flex items-center gap-1.5">
                    <p className="min-w-0 text-sm font-semibold text-fg truncate">{spot.name}</p>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-surface2 text-fg2 text-xs px-2 py-0.5 border border-border">
                      {spot.movie.title}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 지도 영역 — 좌측 열·우측 패널을 제외한 남은 폭. 우측 경계 = 시안 실측 (3열 구분선) */}
      <div className="relative flex-1 min-w-0 md:border-r md:border-border">

      {/* 우하단 안내 배너 — 정보 표시용 (지도 드래그 방해 X) */}
      <div className="absolute bottom-6 right-3 z-[1000] pointer-events-none flex items-center gap-1.5 rounded-xl border border-border bg-card/80 backdrop-blur-sm px-3 py-1.5 shadow-sm">
        <Info size={12} className="text-muted shrink-0" />
        <span className="text-xs text-fg2">촬영지 정보는 국내만 제공됩니다</span>
      </div>

      {/* 지도 캔버스 — 마커·클러스터·이동은 명령형 effect가 관리 (네이버 SDK 직접 소비) */}
      <div ref={mapDivRef} className="w-full h-full" />
      </div>

      {/* 데탑 우측 고정 패널 (A005 §8 미결1 잠정 채택 — 시안 실측 350px, bg 층) */}
      <aside className="hidden md:flex w-[350px] shrink-0 flex-col bg-bg">
        {selectedSpot ? (
          <SpotDetailContent spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-5">
            <div className="w-2 h-2 rounded-full bg-primary mb-2.5" />
            <p className="text-xs text-muted leading-relaxed">
              탐색할 촬영지가 있어요.
              <br />
              촬영지를 선택하면 상세 정보가 표시됩니다.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
