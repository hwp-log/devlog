'use client';
import { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
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

  // 작품별 그룹핑 — JS 내장 Map과 지도 컴포넌트 Map 이름 충돌 방지
  const movieGroups = useMemo(() => {
    const acc = spots.reduce<Record<string, { title: string; count: number }>>((rec, s) => {
      if (rec[s.movie.id]) rec[s.movie.id].count++;
      else rec[s.movie.id] = { title: s.movie.title, count: 1 };
      return rec;
    }, {});
    return Object.entries(acc).map(([id, v]) => ({ id, ...v }));
  }, [spots]);

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

  if (loading) return <div className="w-full h-full bg-slate-100 animate-pulse" />;

  return (
    <div className="relative w-full h-full">
      {/* 작품 칩 바 */}
      <div className="absolute top-3 right-3 z-[1000] flex gap-2 overflow-x-auto pb-1 max-w-[calc(100%-320px)] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setSelectedMovieId(null)}
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
            selectedMovieId === null
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-300'
          }`}
        >
          전체 ({spots.length})
        </button>
        {movieGroups.map((g) => (
          <button
            type="button"
            key={g.id}
            onClick={() => setSelectedMovieId(g.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
              selectedMovieId === g.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            {g.title} ({g.count})
          </button>
        ))}
      </div>

      {/* 사이드 패널 */}
      <div
        className={`absolute left-3 top-14 bottom-3 w-72 z-[1000] bg-white rounded-xl shadow-lg overflow-hidden flex flex-col transition-transform duration-200 ${
          selectedSpot ? 'translate-x-0' : 'translate-x-[calc(-100%-12px)]'
        }`}
      >
        {selectedSpot && (
          <>
            <div className="flex items-start gap-2 p-4 pb-3 border-b border-slate-100">
              <h3 className="flex-1 text-base font-semibold text-[#1A1A1A] leading-snug">
                {selectedSpot.name}
              </h3>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setSelectedSpot(null)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <span className="self-start rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1 border border-indigo-200">
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
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {selectedSpot.author.nickname[0]}
                  </div>
                  <span className="text-sm text-slate-700">{selectedSpot.author.nickname}</span>
                </div>
              </div>
            </div>
          </>
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
