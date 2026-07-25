import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';

interface Props {
  summary: PublicCostSummary;
}

// rank(비중 내림차순 index) → 색 클래스. 완전 리터럴만 JIT 스캔되므로 조합 금지 — 배열로 고정.
// rank6+(최대 6항목: 항공+카테고리 5종)는 Math.min으로 rank5 쌍 재사용(0343 확정 — 순환은 범례 점↔최대 타일 혼동).
const RANK_TILE = [
  'bg-chart1-bg text-chart1-fg',
  'bg-chart2-bg text-chart2-fg',
  'bg-chart3-bg text-chart3-fg',
  'bg-chart4-bg text-chart4-fg',
  'bg-chart5-bg text-chart5-fg',
];
const RANK_DOT = ['bg-chart1-bg', 'bg-chart2-bg', 'bg-chart3-bg', 'bg-chart4-bg', 'bg-chart5-bg'];

// 이름 표시 임계 비중(%) — 미만 타일은 %만 가운데, 이름은 아래 범례로 (시안 실측 12%)
const NAME_MIN_RATIO = 12;

/**
 * 예산 트리맵(0343) — 비중(%)만 표시, 총액·금액 없음(공개 정책).
 * ratios는 summarizePlanCost가 내림차순 정렬 보장 — index가 곧 rank(색 결정).
 * 타일 폭 = flexGrow(비중), flexBasis 0이 비례 폭의 전제. 소비처: story/[id] · plan-finder/[id].
 */
export function PublicCostSection({ summary }: Props) {
  const { ratios } = summary;
  if (ratios.length === 0) return null;

  const legendItems = ratios
    .map((item, rank) => ({ ...item, rank }))
    .filter((item) => item.ratio < NAME_MIN_RATIO);

  return (
    <div className="glass-outer p-5 mb-4">
      <div className="flex gap-[4px] h-[118px]">
        {ratios.map((item, rank) => {
          const showName = item.ratio >= NAME_MIN_RATIO;
          return (
            <div
              key={item.category}
              style={{ flexGrow: item.ratio, flexBasis: 0 }}
              className={`min-w-0 overflow-hidden rounded-[7px] px-[10px] py-[9px] flex flex-col ${
                showName ? 'justify-between' : 'justify-center items-center'
              } ${RANK_TILE[Math.min(rank, 4)]}`}
            >
              {showName && (
                <span className="text-[12.5px] font-medium whitespace-nowrap">{item.label}</span>
              )}
              <span className="text-[12.5px] font-semibold font-mono">{item.ratio}%</span>
            </div>
          );
        })}
      </div>
      {legendItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {legendItems.map((item) => (
            <span key={item.category} className="flex items-center gap-1.5 text-[12px] text-fg2">
              <span
                aria-hidden
                className={`w-2 h-2 rounded-full shrink-0 ${RANK_DOT[Math.min(item.rank, 4)]}`}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
