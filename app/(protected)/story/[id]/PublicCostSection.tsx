import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { formatApproxCost } from '@/lib/plan/format-approx-cost';

interface Props {
  summary: PublicCostSummary;
  headcount: number;
}

// rank(비중 내림차순 index) → 색 클래스. 완전 리터럴만 JIT 스캔되므로 조합 금지 — 배열로 고정.
// rank6+(최대 6항목: 항공+카테고리 5종)는 Math.min으로 rank5 재사용(0343 확정).
const RANK_BAR = ['bg-chart1-bg', 'bg-chart2-bg', 'bg-chart3-bg', 'bg-chart4-bg', 'bg-chart5-bg'];

/**
 * 0492: 예산 요약 — 금액 공개. 총액 먼저 → 한 줄 누적 막대 → 항목별 금액 라벨.
 * (0343 트리맵·"공개 정책(금액 없음)"은 폐기 — 상세는 실금액을 "약 N만원"으로 노출.)
 * ratios는 summarizePlanCost가 비중 내림차순 정렬 보장 — index가 곧 rank(색 결정).
 * 금액은 계획 총액 기준(1인당 환산 없음 — 항목의 1인당/전체 구분이 없어 나누면 틀린 값, 0492 확정).
 * 소비처: plan-finder/[id]뿐(story/[id]·story/new는 요약 한 줄로 대체).
 */
export function PublicCostSection({ summary, headcount }: Props) {
  const { ratios, total, currency } = summary;
  if (ratios.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-fg">총 {formatApproxCost(total, currency)}</span>
        <span className="text-sm text-muted">· {headcount}인</span>
      </div>

      <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-surface2">
        {ratios.map((item, rank) => (
          <div
            key={item.category}
            style={{ flexGrow: item.ratio, flexBasis: 0 }}
            className={RANK_BAR[Math.min(rank, 4)]}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {ratios.map((item, rank) => (
          <div key={item.category} className="flex items-center gap-2 text-[13px]">
            <span
              aria-hidden
              className={`w-2 h-2 rounded-full shrink-0 ${RANK_BAR[Math.min(rank, 4)]}`}
            />
            <span className="text-fg2">{item.label}</span>
            <span className="ml-auto font-medium text-fg">{formatApproxCost(item.amount, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
