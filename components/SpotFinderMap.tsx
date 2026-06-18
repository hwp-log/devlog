'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
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

  const visibleSpots = selectedMovieId
    ? spots.filter((s) => s.movie.id === selectedMovieId)
    : spots;

  // 칩 클릭 시 자동 줌 — visibleSpots 대신 selectedMovieId 의존으로 무한루프 방지
  useEffect(() => {
    if (!mapInstance || visibleSpots.length === 0) return;
    const bounds = new kakao.maps.LatLngBounds();
    visibleSpots.forEach((s) => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng)));
    mapInstance.setBounds(bounds, 80, 40, 40, 40);
  }, [selectedMovieId, mapInstance]);

  // 칩 바 넘침 감지
  useEffect(() => {
    const el = chipBarRef.current;
    if (!el) return;
    const check = () => setShowArrows(el.scrollWidth > el.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredMovieGroups]);

  function scrollChips(dir: 'left' | 'right') {
    chipBarRef.current?.scrollBy({ left: dir === 'right' ? 150 : -150, behavior: 'smooth' });
  }

  if (loading) return <div className="w-full h-full bg-slate-100 animate-pulse" />;

  return (
    <div className="relative w-full h-full">

      {/* 왼쪽 컨테이너: 검색창(항상) + 상세 패널(마커 클릭 시) */}
      <div className="absolute top-3 left-3 z-[1000] w-72 flex flex-col gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="작품명 검색"
          className="w-full rounded-xl px-4 py-2 text-sm border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-sm"
        />

        {selectedSpot && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[calc(100vh-160px)]">
            <div className="relative h-40 flex-shrink-0">
              {selectedSpot.photoUrl ? (
                <img
                  src={selectedSpot.photoUrl}
                  alt={selectedSpot.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                  <span className="text-slate-400 text-sm">No Image</span>
                </div>
              )}
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setSelectedSpot(null)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 hover:bg-white flex items-center justify-center flex-shrink-0 transition-colors text-[#1A1A1A] shadow-sm"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex items-start gap-2 p-4 pb-3 border-b border-slate-100">
              <h3 className="flex-1 text-base font-semibold text-[#1A1A1A] leading-snug">
                {selectedSpot.name}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <span className="self-start rounded-full bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1 border border-slate-200">
                {selectedSpot.movie.title}
              </span>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">촬영지 리뷰</p>
                {selectedSpot.review ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedSpot.review}</p>
                ) : (
                  <p className="text-sm text-slate-400">리뷰 없음</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">출처</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {selectedSpot.author.nickname[0]}
                  </div>
                  <span className="text-sm text-slate-700">{selectedSpot.author.nickname}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 칩 바 + 화살표 — 검색창 오른쪽(left-80)부터 가로 펼침 */}
      <div className="absolute top-3 left-80 right-3 z-[1000] flex items-center gap-2">
        {showArrows && (
          <button
            type="button"
            aria-label="이전"
            onClick={() => scrollChips('left')}
            className="shrink-0 w-7 h-7 rounded-full bg-white text-[#1A1A1A] flex items-center justify-center shadow-sm hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        )}
        <div ref={chipBarRef} className="flex-1 flex gap-2 overflow-x-auto min-w-0 pb-1 [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setSelectedMovieId(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
              selectedMovieId === null
                ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                : 'bg-white text-slate-700 border-slate-300'
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
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-white text-slate-700 border-slate-300'
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
            className="shrink-0 w-7 h-7 rounded-full bg-white text-[#1A1A1A] flex items-center justify-center shadow-sm hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        )}
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
