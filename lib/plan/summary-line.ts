import 'server-only';
import type { PublicCostSummary } from './summarize-plan-cost';

// PLAN 카드 요약 한 줄("N일 · 스팟 N곳 · N인 · 총 약 N만원") — 값 소스는 plan-finder 카드
// 재사용(계산 신설 없음). 없는 값은 그 조각만 생략. 소비처: story/[id](읽기) · story/new·edit(작성).
// 일수 식 = lib/plan/queries.ts dayCount와 동기(전용 유틸 없어 복제 — 출처 명시).
// 금액 = band(구간) 중앙값, plan-finder PlanCard priceLabel과 같은 식. band는 총액을
//   10만/25만/50만원 폭 구간으로 뭉갠 공개 수준(목록 카드 노출 선례). showCost(=isPublic)가
//   false면 금액 조각만 생략(소개·링크의 isPublic 게이트와 같은 방향 — 사용자 확정).
export function buildPlanSummaryLine(input: {
  startDate: Date | null;
  endDate: Date | null;
  spotCount: number;
  headcount: number;
  showCost: boolean;
  band: PublicCostSummary['band'];
}): string {
  return [
    input.startDate && input.endDate
      ? `${Math.max(1, Math.ceil((input.endDate.getTime() - input.startDate.getTime()) / 86_400_000) + 1)}일`
      : null,
    input.spotCount > 0 ? `장소 ${input.spotCount}곳` : null,
    `${input.headcount}인`,
    input.showCost && input.band
      ? `총 약 ${Math.round((input.band.lower + input.band.upper) / 2 / 10_000).toLocaleString()}만원`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
