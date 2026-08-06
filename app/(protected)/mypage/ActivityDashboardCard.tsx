interface Props {
  storyCount: number;
  planCount: number;
  likeCount: number;
  avgWon: number | null;
}

export function ActivityDashboardCard({ storyCount, planCount, likeCount, avgWon }: Props) {
  const items = [
    { label: '스토리', value: `${storyCount}` },
    { label: '계획', value: `${planCount}` },
    { label: '받은 좋아요', value: `${likeCount}` },
    { label: '평균 예산', value: avgWon !== null ? `${avgWon.toLocaleString()}만원` : '-' },
  ];

  return (
    <div className="mt-[28px] sm:mt-[34px]">
      {/* 0529: 섹션 제목 2px 실선은 개방 캔버스(왼쪽)에서만 — 카드 안은 카드 분리가 이미 경계 */}
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-section-rule pb-2 sm:pb-2.5">
        <h2 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.02em] text-fg break-keep">
          내 활동
        </h2>
        <span className="text-xs sm:text-sm text-muted shrink-0">
          <span className="sm:hidden">누적</span>
          <span className="max-sm:hidden">가입 이후 누적</span>
        </span>
      </div>
      {/* 지표 밴드 — 위 2px는 섹션 제목 실선, 아래 1px로 닫는다. 값은 400: 20px vs 라벨 12px 대비로 충분(시안 해설) */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-0 py-[18px] sm:py-5 border-b border-border">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{it.label}</span>
            <span className="text-[20px] font-normal text-fg">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
