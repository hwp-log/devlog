// 카드 그리드 로딩 스켈레톤 — 실제 StoryCardList와 동일 그리드/카드 비율.
// 셔머 표면은 기존 skeleton-shimmer 유틸 재사용(globals.css, --popover/--surface2 토큰 경유 · 라이트/다크 자동).
// shimmer=false: 셔머 없이 치수만(투명 스페이서) — 스테이지 높이 기준 레이어로 재사용(불필요한 애니메이션 방지).
export function StorySkeletonGrid({ count, shimmer = true }: { count: number; shimmer?: boolean }) {
  const s = shimmer ? 'skeleton-shimmer' : '';
  return (
    <div
      aria-hidden
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          {/* 4:3 썸네일 자리 (카드와 동일 비율·radius) */}
          <div className={`aspect-[4/3] rounded-[12px] ${s}`} />
          {/* 제목 2줄 + 메타 1줄 — 카드 최대 텍스트 높이 고정(제목 줄 편차 흡수) */}
          <div className={`mt-2 h-4 w-[85%] rounded ${s}`} />
          <div className={`mt-1.5 h-4 w-3/5 rounded ${s}`} />
          <div className={`mt-2 h-3 w-2/5 rounded ${s}`} />
        </div>
      ))}
    </div>
  );
}
