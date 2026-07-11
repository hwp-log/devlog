'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useKakaoLoader, Map, MapMarker, MarkerClusterer } from 'react-kakao-maps-sdk';
import type { SpotFinderSpot } from '@/lib/spot/queries';

type Props = { spots: SpotFinderSpot[] };

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

  if (loading) return <div className="w-full h-full bg-card animate-pulse" />;

  return (
    <div ref={mapWrapperRef} className="relative w-full h-full">

      {/* 좌측 컨테이너: 검색창 + 칩 줄 + 상세 패널(마커 클릭 시) */}
      <div className="absolute top-3 left-3 right-3 md:right-auto md:w-96 z-[1000] flex flex-col gap-2">
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
          <div className="bg-card rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[calc(100vh-160px)]">
            <div className="relative h-40 flex-shrink-0">
              {selectedSpot.photoUrl ? (
                <img
                  src={selectedSpot.photoUrl}
                  alt={selectedSpot.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-surface2 flex items-center justify-center">
                  <span className="text-muted text-sm">No Image</span>
                </div>
              )}
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setSelectedSpot(null)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-card/80 hover:bg-card flex items-center justify-center flex-shrink-0 transition-colors text-fg shadow-sm"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex items-start gap-2 p-4 pb-3 border-b border-border">
              <h3 className="flex-1 text-base font-semibold text-fg leading-snug">
                {selectedSpot.name}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <span className="self-start rounded-full bg-surface2 text-fg2 text-xs font-medium px-3 py-1 border border-border">
                {selectedSpot.movie.title}
              </span>

              <div>
                <p className="text-xs font-medium text-muted mb-1">촬영지 리뷰</p>
                {selectedSpot.review ? (
                  <p className="text-sm text-fg2 whitespace-pre-wrap">{selectedSpot.review}</p>
                ) : (
                  <p className="text-sm text-muted">리뷰 없음</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-2">출처</p>
                <div className="flex items-center gap-2">
                  {selectedSpot.author.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedSpot.author.avatarUrl}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-fg text-bg text-xs font-semibold flex items-center justify-center flex-shrink-0">
                      {selectedSpot.author.nickname[0]}
                    </div>
                  )}
                  <span className="text-sm text-fg2">{selectedSpot.author.nickname}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
        <MarkerClusterer averageCenter minLevel={10} minClusterSize={1}>
          {visibleSpots.map((spot) => (
            <MapMarker
              key={spot.id}
              position={{ lat: spot.lat, lng: spot.lng }}
              onClick={() => {
                setSelectedSpot(spot);
                mapInstance?.panTo(new kakao.maps.LatLng(spot.lat, spot.lng));
              }}
            />
          ))}
        </MarkerClusterer>
      </Map>
    </div>
  );
}
