// 0278: SpotFinder dynamic-import 폴백 — SpotFinderMapNaver 청크 로드 전(마운트 前) 유일 구간.
// 데이터·naver 비의존 정적 스켈레톤. 마운트 후엔 리스트·상세가 실데이터로 즉시 렌더되므로 여기가
// 유일한 셔머 실재 지점. 실제 3열·모바일 시트 레이아웃을 준용해 전환 시프트 최소화.
// 0488: 실제 화면과 블록 구성 정합 — (모바일 시트) 그래버 h-11·제목행·검색·칩 행·목록,
//   (데탑 좌열) 눈썹+제목·검색·칩 행·목록 flex-1 채움·길찾기 버튼, (데탑 우열) 초기 선택=featuredSpot
//   상세라 히어로+정보목록 밀도. 공유 치수(열 폭·히어로 높이·시트 높이)는 globals.css CSS 변수로 실제와 단일화.
// 색은 skeleton-shimmer 유틸(theme.ts popover/surface2 토큰 경유). 시안: Dotrip Desktop|Mobile Loading.html.

// 목록 채움 행 수 — 데탑 좌열은 flex-1(실제 ul과 동일), 모바일 시트는 고정 시트높이 + 이 행들이 넘쳐
// overflow-hidden으로 클립. 정밀 정합값이 아니라 "가시 용량 초과"용 상한이라 뷰포트 높이가 바뀌어도
// 클립으로 흡수(0488 요구 — 고정 행 수 정합의 재드리프트 회피). 모바일 시트 목록에 flex-1(grow)을 쓰지
// 않는 이유: iOS Safari가 중첩 flex에서 grow를 계산 못 해 한 줄로 붕괴(§5·0252 실측 — 실제 코드가
// 시트 목록에 명시 높이를 쓰는 바로 그 지점).
const FILL_ROWS = 14;

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

// 작품 필터 칩 행 골격 — 실제 칩(rounded-full pill) 근사. 가로 넘침은 overflow-hidden 클립.
function ChipRowSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden">
      <div className="h-8 w-16 rounded-full shrink-0 skeleton-shimmer" />
      <div className="h-8 w-12 rounded-full shrink-0 skeleton-shimmer" />
      <div className="h-8 w-20 rounded-full shrink-0 skeleton-shimmer" />
      <div className="h-8 w-14 rounded-full shrink-0 skeleton-shimmer" />
      <div className="h-8 w-16 rounded-full shrink-0 skeleton-shimmer" />
    </div>
  );
}

// 우측 상세 정보 셀 골격 — 실제 SpotDetailContent 2열 그리드 셀(아이콘 30×30 + 텍스트 2줄) 근사
function InfoCellSkeleton() {
  return (
    <div className="flex items-start gap-[9px]">
      <div className="w-[30px] h-[30px] rounded-[9px] shrink-0 skeleton-shimmer" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3 w-[70%] rounded skeleton-shimmer" />
        <div className="h-2.5 w-[45%] rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

export default function SpotFinderLoadingSkeleton() {
  return (
    <div className="relative w-full h-full flex">
      {/* 데탑 좌열 (모바일 숨김) — 폭·bg·구분선 실제와 동일(폭=var). 구분선 라이트=border / 다크=0.12 실측(0284) */}
      <div className="hidden lg:flex w-[var(--sf-col-left-w)] shrink-0 flex-col gap-2 bg-bg border-r border-border dark:border-[rgba(255,255,255,0.12)] p-3">
        {/* 헤더 — 눈썹 + 제목 (실제 SpotFinder 눈썹 + h1) */}
        <div className="px-2 pt-1.5 pb-0.5">
          <div className="h-3 w-[35%] rounded skeleton-shimmer" />
          <div className="mt-1.5 h-4 w-[70%] rounded skeleton-shimmer" />
        </div>
        {/* 검색 */}
        <div className="h-9 w-full rounded-xl skeleton-shimmer shrink-0" />
        {/* 칩 행 */}
        <ChipRowSkeleton />
        {/* 목록 — flex-1로 열 높이 채움(실제 ul과 동일 방식), 넘치는 행은 클립 → 높이 무관 */}
        <ul className="flex-1 min-h-0 overflow-hidden flex flex-col gap-[7px]">
          {Array.from({ length: FILL_ROWS }).map((_, i) => (
            <li key={i}>
              <RowSkeleton />
            </li>
          ))}
        </ul>
        {/* 길찾기 버튼 — 초기 featuredSpot 선택이라 실제 좌열 하단에 노출 */}
        <div className="h-10 w-full rounded-full shrink-0 skeleton-shimmer" />
      </div>

      {/* 중앙 지도 영역 — 셔머로 채움 */}
      <div className="relative flex-1 min-w-0 skeleton-shimmer lg:border-r lg:border-border dark:lg:border-[rgba(255,255,255,0.12)]" />

      {/* 데탑 우열 (모바일 숨김) — 초기 선택 = featuredSpot 상세라 히어로 + 정보목록. 폭·히어로=var */}
      <aside className="hidden lg:flex w-[var(--sf-col-right-w)] shrink-0 flex-col bg-bg">
        <div className="h-[var(--sf-detail-hero-h)] w-full shrink-0 skeleton-shimmer" />
        {/* 본문 — 실제(h-[calc(100%-hero)] overflow-y-auto)와 동일 높이식. 리뷰 / 2열 정보 그리드 / 작품 목록 */}
        <div className="h-[calc(100%-var(--sf-detail-hero-h))] overflow-hidden p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-[30%] rounded skeleton-shimmer" />
            <div className="h-3 w-[90%] rounded skeleton-shimmer" />
            <div className="h-3 w-[75%] rounded skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-2 gap-[11px] border-b border-border pb-[15px]">
            <InfoCellSkeleton />
            <InfoCellSkeleton />
            <InfoCellSkeleton />
            <InfoCellSkeleton />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-3 w-[35%] rounded skeleton-shimmer" />
            <div className="h-3 w-[80%] rounded skeleton-shimmer" />
            <div className="h-3 w-[60%] rounded skeleton-shimmer" />
          </div>
        </div>
      </aside>

      {/* 0487+0488: 모바일 하단 시트 — 높이 = var(--sf-sheet-half-h)(0487 불변, 시트 튐 방지) + pt-1·
          backdrop-blur-sm·shadow-2xl(그림자 pop 방지). 0488: 안쪽 구성 실제 정합 — 그래버 h-11(실제 셰브론
          버튼 높이, 시각은 pill) · 제목+카운트 행 · 검색 · 칩 행 · 목록(넉넉한 행 + 클립 + 하단 페이드,
          flex-1 grow는 iOS 붕괴로 미사용). */}
      <div className="lg:hidden absolute inset-x-0 bottom-0 flex flex-col h-[var(--sf-sheet-half-h)] overflow-hidden rounded-t-[22px] border border-border bg-card/90 backdrop-blur-sm shadow-2xl pt-1 px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
        {/* 그래버 — 실제 h-11 셰브론 버튼과 같은 높이 영역 점유(내부 시각은 pill) */}
        <div className="h-11 shrink-0 flex items-center justify-center">
          <div className="h-1 w-10 rounded-full skeleton-shimmer" />
        </div>
        {/* 제목 + 카운트 행 */}
        <div className="shrink-0 flex items-center justify-between gap-2">
          <div className="h-5 w-[55%] rounded skeleton-shimmer" />
          <div className="h-4 w-14 rounded shrink-0 skeleton-shimmer" />
        </div>
        {/* 검색 */}
        <div className="mt-2 h-11 w-full rounded-xl shrink-0 skeleton-shimmer" />
        {/* 칩 행 */}
        <div className="mt-2 shrink-0">
          <ChipRowSkeleton />
        </div>
        {/* 목록 — 넉넉한 행이 넘쳐 시트 overflow-hidden으로 클립(높이 무관). 하단 페이드가 pill 존을 가림 */}
        <div className="mt-2 flex flex-col gap-[7px]">
          {Array.from({ length: FILL_ROWS }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
        {/* 하단 페이드 — 실제 시트(SpotFinderMapNaver:1244)와 동형. 클립되는 목록 끝을 부드럽게 + pill 존 마스킹 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(88px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_bottom,transparent,var(--card))]"
        />
      </div>
    </div>
  );
}
