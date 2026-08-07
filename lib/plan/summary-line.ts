import 'server-only';
import { formatAmount } from '@/app/(protected)/my-plan/_lib/cost';

// PLAN 카드 요약 한 줄("N일 · 장소 N곳 · N인 · 총 ₩N") — 값 소스는 plan-finder 카드
// 재사용(계산 신설 없음). 없는 값은 그 조각만 생략. 소비처: story/[id](읽기) · story/new·edit(작성).
// 일수 식 = lib/plan/queries.ts dayCount와 동기(전용 유틸 없어 복제 — 출처 명시).
// 0558: 금액 = band 중앙값 근사 → total 실값(formatAmount). 비공개는 0557 접근 제어가 글 자체를
//   가리므로 구간 가공의 존재 이유 소멸. showCost(=isPublic) 게이트는 유지(비공개 카드는 본인만 봄).
export function buildPlanSummaryLine(input: {
  startDate: Date | null;
  endDate: Date | null;
  spotCount: number;
  headcount: number;
  showCost: boolean;
  total: number;
  currency: 'KRW' | 'USD' | 'JPY';
}): string {
  return [
    input.startDate && input.endDate
      ? `${Math.max(1, Math.ceil((input.endDate.getTime() - input.startDate.getTime()) / 86_400_000) + 1)}일`
      : null,
    input.spotCount > 0 ? `장소 ${input.spotCount}곳` : null,
    `${input.headcount}인`,
    input.showCost && input.total > 0
      ? `총 ${formatAmount(input.total, input.currency)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
