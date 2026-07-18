// 0278: SpotFinder dynamic-import 폴백 — SpotFinderMapNaver 청크가 로드되기 전(마운트 前)의
// 유일한 구간. 데이터·naver 비의존 정적 스켈레톤. 마운트 후엔 리스트·상세가 실데이터로 즉시 렌더되므로
// "리스트 행·상세 셔머"가 실재하는 곳은 여기뿐. 실제 3열 레이아웃 클래스를 준용해 전환 시 시프트 최소화.
// 색은 skeleton-shimmer 유틸(theme.ts popover/surface2 토큰 경유). 시안: Dotrip Desktop|Mobile Loading.html.

// 리스트 행 골격 (썸네일 48 + 텍스트 2줄) — 데탑 좌측·모바일 시트 공용
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2.5">
      <div className="w-12 h-12 rounded-[10px] shrink-0 skeleton-shimmer" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3 w-[70%] rounded skeleton-shimmer" />
        <div className="h-3 w-[45%] rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

export default function SpotFinderLoadingSkeleton() {
  return (
    <div className="relative w-full h-full flex">
      {/* 데탑 좌측 목록 열 (모바일 숨김) — 실제 열과 동일 320px·bg·구분선 */}
      <div className="hidden lg:flex w-[320px] shrink-0 flex-col gap-2 bg-bg border-r border-[rgba(255,255,255,0.12)] p-3">
        <div className="h-4 w-[55%] rounded skeleton-shimmer mt-1" />
        <div className="h-9 w-full rounded-xl skeleton-shimmer" />
        <div className="h-8 w-full rounded-xl skeleton-shimmer" />
        <div className="mt-1 flex flex-col gap-[7px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* 중앙 지도 영역 — 셔머로 채움 */}
      <div className="relative flex-1 min-w-0 skeleton-shimmer lg:border-r lg:border-[rgba(255,255,255,0.12)]" />

      {/* 데탑 우측 상세 패널 (모바일 숨김) — 히어로 210 + 텍스트 골격 */}
      <aside className="hidden lg:flex w-[350px] shrink-0 flex-col bg-bg">
        <div className="h-[210px] w-full skeleton-shimmer" />
        <div className="flex flex-col gap-3 p-4">
          <div className="h-4 w-[55%] rounded skeleton-shimmer" />
          <div className="h-3 w-[85%] rounded skeleton-shimmer" />
          <div className="h-3 w-[70%] rounded skeleton-shimmer" />
        </div>
      </aside>

      {/* 모바일 하단 시트 골격 (데탑 숨김) — 실제 시트와 동일 바닥밀착·라운드 */}
      <div className="lg:hidden absolute inset-x-0 bottom-0 flex flex-col rounded-t-[22px] border border-border bg-card/90 pt-3 px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
        <div className="self-center h-1 w-10 rounded-full skeleton-shimmer" />
        <div className="mt-3 h-5 w-[60%] rounded skeleton-shimmer" />
        <div className="mt-2 h-11 w-full rounded-xl skeleton-shimmer" />
        <div className="mt-2 flex flex-col gap-[7px]">
          {Array.from({ length: 3 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
