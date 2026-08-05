import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { formatApproxCost } from '@/lib/plan/format-approx-cost';
import { formatDayLabel, addDays } from '@/lib/plan/format-day-label';
import { CATEGORY_LABEL } from '@/app/(protected)/my-plan/_lib/cost';

// 0498: 항목 카테고리 라벨 — 항공은 합성 카테고리라 별도 매핑.
type ItemGroup = PublicCostSummary['itemGroups'][number];
type Item = ItemGroup['items'][number];
type ItemCategory = Item['category'];
function categoryLabel(category: ItemCategory): string {
  return category === 'FLIGHT' ? '항공' : CATEGORY_LABEL[category];
}

// 0505: 3열 항목 행 — [항목명 flex truncate] [카테고리 11px] [금액 우측]. 마지막 행만 아래 선 없음.
function ItemRow({
  item,
  currency,
  last,
}: {
  item: Item;
  currency: PublicCostSummary['currency'];
  last: boolean;
}) {
  // 항공 합성 항목은 '항공권'으로 표기(0505 목표3).
  const name = item.category === 'FLIGHT' ? '항공권' : item.label;
  return (
    <div
      className={`flex items-baseline gap-2 py-1.5 text-[13px]${last ? '' : ' border-b border-border/60'}`}
    >
      <span className="text-fg2 truncate min-w-0">{name}</span>
      <span className="text-[11px] text-muted shrink-0">{categoryLabel(item.category)}</span>
      <span className="ml-auto shrink-0 font-medium text-fg">{formatApproxCost(item.amount, currency)}</span>
    </div>
  );
}

interface Props {
  summary: PublicCostSummary;
  headcount: number;
  // 0505: 일자 라벨용. null이면 일자 라벨을 "DAY N"으로 폴백.
  startDate: Date | null;
  endDate: Date | null;
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
export function PublicCostSection({ summary, headcount, startDate, endDate }: Props) {
  const { ratios, itemGroups, total, currency } = summary;
  if (ratios.length === 0) return null;

  // 0505: 두 층으로 분리 — 고정 비용(day=null: 항공권 + 무장소) / 일자별 비용(day 있는 그룹).
  //   summarize의 itemGroups 순서(항공 → 여행 전체 → Day)를 그대로 이어받아 항공권이 고정 맨 위.
  const fixedItems = itemGroups.filter((g) => g.day === null).flatMap((g) => g.items);
  const dayGroups = itemGroups.filter((g): g is ItemGroup & { day: number } => g.day !== null);
  const periodLabel =
    startDate && endDate ? `${formatDayLabel(startDate)} ~ ${formatDayLabel(endDate)}` : null;
  const dayDateLabel = (day: number) =>
    startDate ? formatDayLabel(addDays(startDate, day - 1)) : `DAY ${day}`;

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

      {/* 0505: 두 층(고정 / 일자별). 각 층 = 큰 제목(진한 구분선+14px 굵게) → 날짜 라벨(12px 회색) → 3열 항목.
          한쪽이 비면 그 제목도 생략(목표6). 계층은 색·선이 아니라 위치(날짜 라벨만 왼쪽 머리)로 가른다. */}
      {fixedItems.length > 0 && (
        <div className="mt-4">
          <p className="pt-4 border-t border-fg/15 text-sm font-bold text-fg">여행 고정 비용</p>
          {periodLabel && <p className="mt-1.5 text-xs text-muted">{periodLabel}</p>}
          <div className="mt-1.5">
            {fixedItems.map((item, i) => (
              <ItemRow key={`fixed-${i}`} item={item} currency={currency} last={i === fixedItems.length - 1} />
            ))}
          </div>
        </div>
      )}

      {dayGroups.length > 0 && (
        <div className="mt-4">
          <p className="pt-4 border-t border-fg/15 text-sm font-bold text-fg">여행 일자별 비용</p>
          {/* 0505 후속: 제목→첫 일자를 고정 비용과 동일하게(mt-1.5=6px, 붙이지 않고 띄움). gap-3은 일자 그룹 사이(8.5→8.6)만 담당 */}
          <div className="mt-1.5 flex flex-col gap-3">
            {dayGroups.map((group) => (
              <div key={group.day}>
                <p className="text-xs text-muted">{dayDateLabel(group.day)}</p>
                <div className="mt-1">
                  {group.items.map((item, i) => (
                    <ItemRow
                      key={`day-${group.day}-${i}`}
                      item={item}
                      currency={currency}
                      last={i === group.items.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
