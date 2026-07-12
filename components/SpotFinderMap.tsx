'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useKakaoLoader, Map, CustomOverlayMap, MarkerClusterer } from 'react-kakao-maps-sdk';
import type { SpotFinderSpot } from '@/lib/spot/queries';
import { theme, withAlpha } from '@/lib/theme';

const PRIMARY = theme.common.primary;

// 클러스터 원: 클릭 영역 = 스타일 div 자체라 CLAUDE.md §5 터치 타겟 기준으로 44px (판단값)
const CLUSTER_STYLES = [{
  width: '44px',
  height: '44px',
  borderRadius: '9999px',
  background: PRIMARY, // A005 "채움(+흰 글자)" — 개수 구간 없이 primary 단색 고정
  border: '2px solid #fff',
  color: '#fff',
  fontSize: '12px',
  fontWeight: '600',
  textAlign: 'center',
  lineHeight: '40px',
  boxShadow: `0 0 0 6px ${withAlpha(PRIMARY, 0.15)}`,
}];

type Props = { spots: SpotFinderSpot[] };

// 상세 콘텐츠 단일 정의 — 모바일 플로팅 카드와 데탑 우측 고정 패널이 공유 (내용·순서 동일)
function SpotDetailContent({ spot, onClose }: { spot: SpotFinderSpot; onClose: () => void }) {
  return (
    <>
      <div className="relative h-40 flex-shrink-0">
        {spot.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spot.photoUrl} alt={spot.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface2 flex items-center justify-center">
            <span className="text-muted text-sm">No Image</span>
          </div>
        )}
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-card/80 hover:bg-card flex items-center justify-center flex-shrink-0 transition-colors text-fg shadow-sm"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex items-start gap-2 p-4 pb-3 border-b border-border">
        <h3 className="flex-1 text-base font-semibold text-fg leading-snug">{spot.name}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <span className="self-start rounded-full bg-surface2 text-fg2 text-xs font-medium px-3 py-1 border border-border">
          {spot.movie.title}
        </span>

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

export default function SpotFinderMap({ spots }: Props) {
  const [loading] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY!,
    libraries: ['services', 'clusterer'],
  });

  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<SpotFinderSpot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArrows, setShowArrows] = useState(false);
  const chipBarRef = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const userInteractedRef = useRef(false);
  const lastProgrammaticFitTsRef = useRef(0);

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

  // 칩 클릭 시 자동 줌 — visibleSpots 대신 selectedMovieId 의존으로 무한루프 방지
  useEffect(() => {
    if (!mapInstance || visibleSpots.length === 0) return;
    const bounds = new kakao.maps.LatLngBounds();
    visibleSpots.forEach((s) => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng)));
    lastProgrammaticFitTsRef.current = Date.now();
    mapInstance.setBounds(bounds, 110, 40, 40, 40);
  }, [selectedMovieId, mapInstance]);

  // 사용자 조작 감지 — dragstart / zoom_start(시간창 가드)
  useEffect(() => {
    if (!mapInstance) return;
    const onDragStart = () => { userInteractedRef.current = true; };
    const onZoomStart = () => {
      if (Date.now() - lastProgrammaticFitTsRef.current < 500) return;
      userInteractedRef.current = true;
    };
    kakao.maps.event.addListener(mapInstance, 'dragstart', onDragStart);
    kakao.maps.event.addListener(mapInstance, 'zoom_start', onZoomStart);
    return () => {
      kakao.maps.event.removeListener(mapInstance, 'dragstart', onDragStart);
      kakao.maps.event.removeListener(mapInstance, 'zoom_start', onZoomStart);
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
  }, [filteredMovieGroups, loading]);

  // 컨테이너 크기 변경 시: 항상 relayout, 사용자 조작 전이면 bounds 재적합 / 이후면 center 보존
  useEffect(() => {
    const el = mapWrapperRef.current;
    if (!el || !mapInstance) return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = mapInstance.getCenter();
        mapInstance.relayout();
        if (!userInteractedRef.current && visibleSpots.length > 0) {
          const bounds = new kakao.maps.LatLngBounds();
          visibleSpots.forEach((s) => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng)));
          lastProgrammaticFitTsRef.current = Date.now();
          mapInstance.setBounds(bounds, 110, 40, 40, 40);
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
    mapInstance?.panTo(new kakao.maps.LatLng(spot.lat, spot.lng));
  }

  if (loading) return <div className="w-full h-full bg-card animate-pulse" />;

  return (
    <div ref={mapWrapperRef} className="relative w-full h-full flex">
      {/* 좌측 칼럼 — 모바일: 지도 위 플로팅(absolute) / md: 320px 정적 열 (같은 DOM, 클래스 전환) */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col gap-2 md:static md:top-auto md:left-auto md:right-auto md:z-auto md:w-[320px] md:shrink-0 md:h-full md:bg-bg md:border-r md:border-border md:p-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="작품명 검색"
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
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{spot.name}</p>
                    <span className="inline-block mt-1 rounded-full bg-surface2 text-fg2 text-xs px-2 py-0.5 border border-border truncate max-w-full">
                      {spot.movie.title}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 지도 영역 — 좌측 열·우측 패널을 제외한 남은 폭 */}
      <div className="relative flex-1 min-w-0">

      {/* 우하단 안내 배너 — 정보 표시용 (지도 드래그 방해 X) */}
      <div className="absolute bottom-6 right-3 z-[1000] pointer-events-none flex items-center gap-1.5 rounded-xl border border-border bg-card/80 backdrop-blur-sm px-3 py-1.5 shadow-sm">
        <Info size={12} className="text-muted shrink-0" />
        <span className="text-xs text-fg2">촬영지 정보는 국내만 제공됩니다</span>
      </div>

      <Map
        center={{ lat: 36.5, lng: 127.8 }}
        level={13}
        className="w-full h-full"
        onCreate={setMapInstance}
      >
        <MarkerClusterer averageCenter minLevel={10} minClusterSize={1} styles={CLUSTER_STYLES}>
          {visibleSpots.map((spot) => {
            const selected = selectedSpot?.id === spot.id;
            return (
              <CustomOverlayMap
                key={spot.id}
                position={{ lat: spot.lat, lng: spot.lng }}
                zIndex={selected ? 2 : 1}
              >
                {/* 히트 영역(44×44 투명)과 시각 점(14px) 분리 — CLAUDE.md §5 터치 타겟 */}
                <div
                  onClick={() => handleSpotSelect(spot)}
                  style={{
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 9999,
                      background: PRIMARY,
                      border: '2px solid #fff',
                      // 선택 글로우 알파 0.15/0.08 = 정본 시안 링 실측값
                      boxShadow: selected
                        ? `0 0 0 6px ${withAlpha(PRIMARY, 0.15)}, 0 0 0 12px ${withAlpha(PRIMARY, 0.08)}, 0 2px 4px rgba(0,0,0,0.3)`
                        : '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                  {selected && (
                    <div
                      style={{
                        position: 'absolute',
                        width: 24,
                        height: 24,
                        borderRadius: 9999,
                        background: withAlpha(PRIMARY, 0.4),
                        animation: 'spot-pulse 0.6s ease-out forwards',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
              </CustomOverlayMap>
            );
          })}
        </MarkerClusterer>
      </Map>
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
