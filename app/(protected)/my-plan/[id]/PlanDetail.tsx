'use client';
import { useState, useTransition, useOptimistic } from 'react';
import Link from 'next/link';
import type { MyPlan, PlanSpot, PlanCost, PlanFlight } from '@prisma/client';
import { FlightLeg, type FlightLegData } from '../_components/FlightLeg';
import { CostSection } from '../_components/CostSection';
import { buildTimeline, type TimelineItem } from '../_components/PlanTimeline';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';
import { calcCostSummary } from '@/lib/plan/calc-cost-summary';
import { CATEGORY_LABEL, formatAmount, type CostCategory } from '../_lib/cost';
import { formatDayLabel, addDays } from '@/lib/plan/format-day-label';
import { togglePlanPublicAction } from './actions';
import Image from 'next/image';
import { PencilLine, Trash2 } from 'lucide-react';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { SectionHeader } from '@/app/(protected)/_components/SectionHeader';
import { BTN_ICON_CHIP } from '@/lib/button-styles';

// 0555: 히어로 커버 sizes — 공개 상세(PlanFinderDetail HERO_SIZES)와 짝(리터럴 복제 —
// 로컬 const라 참조 불가. 한쪽만 바꾸면 서빙 해상도가 갈린다).
const HERO_SIZES = '(max-width: 767px) 100vw, 860px';

function planFlightToLegData(f: PlanFlight): FlightLegData {
  return {
    tripType: f.tripType as 'ONE_WAY' | 'ROUND_TRIP',
    totalAmount: f.totalAmount,
    out: {
      origin: f.outOrigin,
      destination: f.outDestination,
      departsAt: f.outDepartsAt.toISOString(),
      arrivesAt: f.outArrivesAt.toISOString(),
      airline: f.outAirline,
      flightNo: f.outFlightNo,
    },
    ...(f.retOrigin ? {
      ret: {
        origin: f.retOrigin,
        destination: f.retDestination!,
        departsAt: f.retDepartsAt!.toISOString(),
        arrivesAt: f.retArrivesAt!.toISOString(),
        airline: f.retAirline!,
        flightNo: f.retFlightNo!,
      },
    } : {}),
  };
}


type FullPlan = MyPlan & { spots: PlanSpot[]; costs: PlanCost[]; flight: PlanFlight | null };

interface Props {
  plan: FullPlan;
  dayCount: number;
  deleteAction: (planId: string) => Promise<void>;
  // 0555: 메타 행(공개 상세 동형)용
  ownerNickname: string;
  ownerAvatarUrl: string | null;
  createdAtLabel: string;
}


export function PlanDetail({ plan, dayCount, deleteAction, ownerNickname, ownerAvatarUrl, createdAtLabel }: Props) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [isPendingPublic, startPublicTransition] = useTransition();
  const [optimisticPublic, setOptimisticPublic] = useOptimistic(
    plan.isPublic,
    (_, next: boolean) => next,
  );

  const handleTogglePublic = () => {
    const next = !optimisticPublic;
    startPublicTransition(async () => {
      setOptimisticPublic(next);
      await togglePlanPublicAction(plan.id, next);
    });
  };

  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const timeline: TimelineItem[] = buildTimeline(plan.spots, plan.costs, selectedDay);

  const costSummary = calcCostSummary(plan.costs);
  const flightAmount = plan.flight?.totalAmount ?? 0;
  const total = calcPlanTotal(plan.costs, plan.flight);
  // 0504 2단계: 무장소 비용(day·planSpotId 둘 다 NULL) — 타임라인엔 안 떠서 소유자에게 별도 표시.
  //   총액·카테고리 바엔 이미 합산됨(표시만 추가, 재합산 아님).
  const daylessCosts = plan.costs.filter((c) => c.day == null && c.planSpotId == null);
  // 0555: 지표 밴드용 — 공개 상세 durationLabel과 동일 산식
  const durationLabel = dayCount > 1 ? `${dayCount - 1}박 ${dayCount}일` : '당일';

  return (
    // 0555: 읽기 화면 공용 폭 --reading-w(860) — §10 잔여 미편입 해소. 골격은 공개 상세
    // (PlanFinderDetail 0534)와 짝 — 같은 플랜의 두 뷰가 같은 정렬선을 갖는다.
    <div className="max-w-[var(--reading-w)] mx-auto">
      {/* 히어로 — 공개 상세 115~132행 준용(커버 + 지역 칩 + 제목). 커버 없으면 인라인 h1 */}
      {plan.coverUrl && (
        <div className="relative w-full h-[200px] sm:h-[300px] rounded-[14px] overflow-hidden mb-4">
          <Image src={plan.coverUrl} alt="" fill sizes={HERO_SIZES} className="object-cover" />
          <div className="absolute inset-0 bg-hero-veil" />
          <div className="absolute inset-x-0 bottom-0 h-[130px] sm:h-[160px] sm:dark:h-[220px] bg-gradient-to-t from-hero-scrim to-transparent" />
          {plan.region && (
            <span className="absolute left-4 top-[14px] sm:top-6 inline-flex items-center text-[11px] sm:text-xs leading-none font-semibold text-white bg-[rgba(15,17,18,0.62)] rounded px-[9px] py-1 sm:px-[11px] sm:py-[5px]">
              {plan.region}
            </span>
          )}
          <h1 className="absolute left-4 right-4 bottom-4 sm:bottom-[26px] text-[22px] leading-[1.3] sm:text-[28px] font-bold tracking-[-0.02em] text-white break-keep">
            {plan.title}
          </h1>
        </div>
      )}

      <div className="mb-6">
        {!plan.coverUrl && (
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.02em] text-fg break-keep">
              {plan.title}
            </h1>
          </div>
        )}

        {/* 메타 행 — 공개 상세 동형(아바타·닉네임·작성일). 우측 = 소유자 버튼군(0481 선례:
            메타 행 우측 아이콘). 공개 전환만 pill — 상태 표시를 겸하는 토글이라 아이콘으론
            현재 상태가 안 읽힘. 수정·삭제는 아이콘 칩(스토리 상세 DeleteButton과 동일 재질). */}
        <div className={`flex items-center justify-between gap-5 ${plan.coverUrl ? '' : 'mt-2'}`}>
          <div className="flex items-center gap-2 text-[13px] sm:text-sm text-muted min-w-0">
            <AuthorAvatar nickname={ownerNickname} avatarUrl={ownerAvatarUrl} />
            <span className="text-fg font-semibold truncate">{ownerNickname}</span>
            <span className="opacity-40">·</span>
            <span className="shrink-0">{createdAtLabel}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTogglePublic}
              disabled={isPendingPublic}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 ${
                optimisticPublic
                  ? 'bg-fg text-bg'
                  : 'border border-border text-fg2 hover:bg-surface2'
              }`}
            >
              {optimisticPublic ? '공개 중' : '비공개'}
            </button>
            <Link
              href={`/my-plan/${plan.id}/edit`}
              aria-label="수정"
              className={`${BTN_ICON_CHIP} text-fg2 hover:text-fg`}
            >
              <PencilLine size={18} />
            </Link>
            <button
              type="button"
              onClick={() => {
                if (!confirm('계획을 삭제하시겠습니까?')) return;
                startTransition(() => deleteAction(plan.id));
              }}
              disabled={isPending}
              aria-label="삭제"
              className={`${BTN_ICON_CHIP} text-fg2 hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        {/* 공개 가공 안내 — 유지(공개 실값/근사 차이를 설명하는 장치) */}
        <p className="mt-1.5 text-xs text-muted text-right">
          공개하면 비용이 비중·구간으로 가공되어 표시됩니다 (정밀 금액은 비공개)
        </p>

        {/* 커버 없을 때 지역·작품 칩 인라인(커버 있으면 지역은 히어로 안 — 공개 상세 동형) */}
        {!plan.coverUrl && (plan.region || plan.movie) && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {plan.region && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-surface2 text-fg2 border border-border">
                {plan.region}
              </span>
            )}
            {plan.movie && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-surface2 text-fg2 border border-border">
                {plan.movie}
              </span>
            )}
          </div>
        )}

        {/* 지표 밴드 3열 — 공개 상세 168~185행 클래스 짝. 총 비용은 실값(소유자 화면 — 0555 판정) */}
        <div className="mt-[14px] sm:mt-[22px] grid grid-cols-3 gap-x-2 py-[14px] sm:py-5 border-t border-b border-border">
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <span className="text-[11px] sm:text-xs sm:font-medium text-muted">기간</span>
            <span className="text-base sm:text-xl font-bold text-fg">{durationLabel}</span>
          </div>
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <span className="text-[11px] sm:text-xs sm:font-medium text-muted">장소</span>
            <span className="text-base sm:text-xl font-bold text-fg">{plan.spots.length}곳</span>
          </div>
          {total > 0 && (
            <div className="flex flex-col gap-[3px] sm:gap-1">
              <span className="text-[11px] sm:text-xs sm:font-medium text-muted">총 비용</span>
              <span className="text-base sm:text-xl font-bold text-fg">
                {formatAmount(total, plan.currency as 'KRW' | 'USD' | 'JPY')}
              </span>
            </div>
          )}
        </div>

        {/* 소개문 — glass 카드 폐기, 본문 텍스트(공개 상세 195~199행 준용) */}
        {plan.description && (
          <p className="mt-[14px] sm:mt-[22px] break-keep text-[15px] leading-[1.7] sm:text-base sm:leading-[1.75] text-fg2 text-pretty whitespace-pre-wrap">
            {plan.description}
          </p>
        )}
      </div>

      {/* 여행 일정 — 공용 SectionHeader(0531 첫 적용) + 공개 상세 스타일 Day 탭·행 목록 */}
      <div className="mt-4">
        <SectionHeader title="여행 일정" sub="내가 넣은 순서" />
      </div>

      <div className="flex gap-1.5 sm:gap-2 mt-4 mb-6 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${
              selectedDay === d
                ? 'bg-fg text-bg'
                : 'bg-card border border-border text-fg2 hover:bg-surface2'
            }`}
          >
            {/* 0511: Day N 병기 제거 — 날짜만(0505 비용 라벨과 동일 포맷, 세 화면 통일). startDate 없으면 방어 폴백 */}
            {plan.startDate ? formatDayLabel(addDays(plan.startDate, d - 1)) : `Day ${d}`}
          </button>
        ))}
      </div>

      {/* 0555: 일정 행 — 공개 상세(0513) 형태의 번호+이름+hairline 행. 썸네일·주소는 PlanSpot에
          데이터가 없어 열 생략(0517 "없으면 열 생략" 규칙). 연결 비용 금액은 우측 인라인 유지
          (실값·"무료" 규칙 — PlanTimeline 기능 승계). 번호색 #b3b9bd는 공개 상세 리터럴과 짝. */}
      <div className="flex flex-col">
        {timeline.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">항목이 없습니다.</p>
        ) : (
          timeline.map(({ spot, cost }, i) => (
            <div
              key={spot.id}
              className="flex items-center gap-2.5 sm:gap-3 py-[13px] sm:py-[14px] border-b border-hairline"
            >
              <span className="w-[22px] shrink-0 text-xs sm:text-sm font-bold text-[#b3b9bd]">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 text-[15px] sm:text-base font-medium text-fg2 break-keep">
                {spot.name}
              </span>
              {cost != null && (
                <span className="shrink-0 text-xs sm:text-sm font-semibold text-cost-amount">
                  {cost.amount > 0
                    ? formatAmount(cost.amount, plan.currency as 'KRW' | 'USD' | 'JPY')
                    : '무료'}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* 0527: 섹션 라벨이 CostSection 안에서 호출부로 나왔다(작성 화면은 22px SectionHeader가 담당).
          이 화면은 형제 섹션이 아직 12px 라벨이라 그 어휘를 유지 — 위계 정돈은 별도 사이클. */}
      {/* 예상 비용 — 공개 상세 순서(일정→비용→항공). CostSection은 0527에서 이미 토큰화 — 무접촉.
          sub "실제 입력값" = 공개의 "총액 기준 · 1인 환산 없음"과 대구(실값/근사 차이 명시). */}
      <div className="mt-7 sm:mt-11">
        <SectionHeader title="예상 비용" sub="실제 입력값" />
        <CostSection
          totals={costSummary}
          flightAmount={flightAmount}
          total={total}
          currency={plan.currency as 'KRW' | 'USD' | 'JPY'}
        />
        {/* 0504/0505 여행 고정 비용 — glass 폐기, 3열([항목][카테고리][금액]) 토큰 행.
            카테고리 11px → 12px(§5 하한). 항목 있을 때만. */}
        {daylessCosts.length > 0 && (
          <div className="mt-5">
            <p className="text-[15px] font-semibold text-fg2">여행 고정 비용</p>
            <div className="mt-1">
              {daylessCosts.map((c, i) => (
                <div
                  key={c.id}
                  className={`flex items-baseline gap-2 py-[11px] text-sm${i === daylessCosts.length - 1 ? '' : ' border-b border-hairline'}`}
                >
                  <span className="text-fg2 truncate min-w-0">{c.label}</span>
                  <span className="text-xs text-muted shrink-0">{CATEGORY_LABEL[c.category as CostCategory]}</span>
                  <span className="ml-auto shrink-0 font-semibold text-cost-amount">
                    {formatAmount(c.amount, plan.currency as 'KRW' | 'USD' | 'JPY')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 항공편 — FlightLeg 유지(형태 교체는 목표 밖), 제목만 SectionHeader */}
      {plan.flight && (
        <div className="mt-7 sm:mt-11">
          <SectionHeader title="항공편" sub="예상" />
          <div className="mt-4">
            <FlightLeg data={planFlightToLegData(plan.flight)} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {plan.sourcePlanId && (
          <Link
            href={`/plan-finder/${plan.sourcePlanId}`}
            className="text-sm text-muted hover:text-fg transition-colors"
          >
            원본 플랜 보기 →
          </Link>
        )}
        <Link href="/my-plan" className="text-sm text-muted hover:text-fg transition-colors">
          ← 목록으로
        </Link>
      </div>
    </div>
  );
}
