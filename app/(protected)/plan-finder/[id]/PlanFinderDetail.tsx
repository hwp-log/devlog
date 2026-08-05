'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PlanTimeline, buildTimeline } from '@/app/(protected)/my-plan/_components/PlanTimeline';
import { PublicCostSection } from '@/app/(protected)/story/[id]/PublicCostSection';
import { PublicFlightTable } from './PublicFlightTable';
import { PlanLikeButton } from './PlanLikeButton';
import { CopyPlanFinderButton } from './CopyPlanFinderButton';
import type { FlightLegData } from '@/app/(protected)/my-plan/_components/FlightLeg';
import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { formatApproxCost } from '@/lib/plan/format-approx-cost';
import { formatDayLabel, addDays } from '@/lib/plan/format-day-label';
import { AuthorAvatar } from '@/components/AuthorAvatar';

interface Props {
  planId: string;
  initialLiked: boolean;
  initialCount: number;
  title: string;
  description: string | null;
  region: string | null;
  movie: string | null;
  coverUrl: string | null;
  headcount: number;
  createdAtLabel: string;
  dayCount: number;
  // 0505: 비용 목록 일자 라벨용(PublicCostSection로 전달).
  startDate: Date | null;
  endDate: Date | null;
  spots: { id: string; day: number; name: string; order?: number; lat?: number | null; lng?: number | null; coverUrl?: string | null; address?: string | null; movie?: string | null }[];
  costCategories: { planSpotId: string | null; category: string; amount: number }[];
  publicFlight: FlightLegData | null;
  summary: PublicCostSummary;
  currency: 'KRW' | 'USD' | 'JPY';
  authorNickname: string;
  authorAvatarUrl: string | null;
  isOwner: boolean;
}

// 히어로 커버 sizes — 본문 컬럼 폭 기준(모바일 100vw, 데스크톱 컬럼 폭 ≈640px).
const HERO_SIZES = '(max-width: 767px) 100vw, 640px';

export function PlanFinderDetail({
  planId,
  initialLiked,
  initialCount,
  title,
  description,
  region,
  coverUrl,
  headcount,
  createdAtLabel,
  dayCount,
  startDate,
  endDate,
  spots,
  costCategories,
  publicFlight,
  summary,
  currency,
  authorNickname,
  authorAvatarUrl,
  isOwner,
}: Props) {
  const [selectedDay, setSelectedDay] = useState(1);

  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const timeline = buildTimeline(spots, costCategories, selectedDay);

  // 0494/0496: 그날 촬영지 사진 그리드 — 커버 있는 항목 전부, order순.
  //   0496: 히어로 디둡 제거 — 히어로=코스 인상 / 그리드=그날 동선 목록이라 역할이 달라 겹쳐도 중복 아님.
  //   (첫 장소가 히어로와 같아도 빼면 "그날 안 가나?" 오해가 더 커 디둡보다 손해.)
  const dayPhotos = spots
    .filter((s) => s.day === selectedDay && s.coverUrl)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const durationLabel = dayCount > 1 ? `${dayCount - 1}박 ${dayCount}일` : '당일';

  const actionButtons = (
    <div className="flex items-center gap-2 shrink-0">
      {!isOwner && <CopyPlanFinderButton planId={planId} />}
      <PlanLikeButton planId={planId} initialLiked={initialLiked} initialCount={initialCount} />
    </div>
  );

  return (
    <div>
      {/* 0512: 히어로에 제목(좌하단)·지역 칩(좌상단) — 시안 4a/4d. 좌우 인셋은 시안 40px가
          전체 페이지 패딩 기준이라 컬럼 폭인 우리 히어로엔 기존 16px 유지. */}
      {coverUrl && (
        <div className="relative w-full h-[200px] md:h-[300px] rounded-[14px] overflow-hidden mb-4">
          <Image src={coverUrl} alt="" fill sizes={HERO_SIZES} className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-[130px] md:h-[160px] bg-gradient-to-t from-[rgba(10,12,13,0.74)] md:from-[rgba(10,12,13,0.72)] to-transparent" />
          {region && (
            <span className="absolute left-4 top-[14px] md:top-6 inline-flex items-center text-[11px] md:text-xs leading-none font-semibold text-white bg-[rgba(15,17,18,0.62)] rounded px-[9px] py-1 md:px-[11px] md:py-[5px]">
              {region}
            </span>
          )}
          <h1 className="absolute left-4 right-4 bottom-4 md:bottom-[26px] text-[22px] leading-[1.3] md:text-[30px] font-bold tracking-[-0.02em] text-white break-keep">
            {title}
          </h1>
        </div>
      )}

      <div className="mb-6">
        {/* 커버 없는 플랜은 기존대로 히어로 생략 — 제목·버튼 인라인 유지 */}
        {!coverUrl && (
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-bold text-fg break-keep">{title}</h1>
            {actionButtons}
          </div>
        )}

        {/* 메타 — 작성자·날짜, 커버 있으면 버튼을 우측에(시안 4a의 ♥ 자리) */}
        <div className={`flex items-center justify-between gap-5 ${coverUrl ? '' : 'mt-2'}`}>
          <div className="flex items-center gap-2 text-[13px] md:text-sm text-muted">
            <AuthorAvatar nickname={authorNickname} avatarUrl={authorAvatarUrl} />
            <span className="text-fg font-semibold">{authorNickname}</span>
            <span className="opacity-40">·</span>
            <span>{createdAtLabel}</span>
          </div>
          {coverUrl && actionButtons}
        </div>

        {/* 커버 없을 때 지역 칩은 인라인으로 유지(작품 칩은 별도 트랙이라 제외) */}
        {!coverUrl && region && (
          <div className="mt-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-surface2 text-fg2 border border-border">
              {region}
            </span>
          </div>
        )}

        {/* 0512: 지표 밴드 3열(기간·장소·총 비용) — 요약 앵커 한 줄 대체, 위아래 구분선 */}
        <div className="mt-[14px] md:mt-[22px] grid grid-cols-3 md:grid-cols-[repeat(3,max-content)] gap-x-2 md:gap-x-14 py-[14px] md:py-5 border-t border-b border-border">
          <div className="flex flex-col gap-[3px] md:gap-1">
            <span className="text-[11px] md:text-xs md:font-medium text-muted">기간</span>
            <span className="text-base md:text-xl font-bold text-fg">{durationLabel}</span>
          </div>
          <div className="flex flex-col gap-[3px] md:gap-1">
            <span className="text-[11px] md:text-xs md:font-medium text-muted">장소</span>
            <span className="text-base md:text-xl font-bold text-fg">{spots.length}곳</span>
          </div>
          {summary.total > 0 && (
            <div className="flex flex-col gap-[3px] md:gap-1">
              <span className="text-[11px] md:text-xs md:font-medium text-muted">총 비용</span>
              <span className="text-base md:text-xl font-bold text-fg">
                {formatApproxCost(summary.total, currency)}
              </span>
            </div>
          )}
        </div>

        {/* 0512: 소개문 — 회색 박스 제거, 본문 텍스트로 */}
        {description && (
          <p className="mt-[14px] md:mt-[22px] max-w-[720px] text-[15px] leading-[1.7] md:text-base md:leading-[1.75] text-fg2 text-pretty whitespace-pre-wrap">
            {description}
          </p>
        )}
      </div>

      {/* 여행 일정 */}
      <p className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">여행 일정</p>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedDay === d
                ? 'bg-fg text-bg'
                : 'bg-card border border-border text-fg2 hover:bg-surface2'
            }`}
          >
            {/* 0511: 비용 섹션(0505)과 동일 포맷 — Day N 병기 없이 날짜만(세 화면 통일). startDate 없으면 방어 폴백 */}
            {startDate ? formatDayLabel(addDays(startDate, d - 1)) : `Day ${d}`}
          </button>
        ))}
      </div>

      {/* 0494: 그날 촬영지 사진 그리드 — 일정 목록 위, 가로 나열. 한 장도 없으면 생략. */}
      {dayPhotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
          {dayPhotos.map((s) => (
            <div key={s.id} className="relative w-[132px] h-[92px] shrink-0 rounded-[10px] overflow-hidden">
              <Image src={s.coverUrl!} alt="" fill sizes="132px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5">
                <p className="text-[11px] font-semibold text-white truncate">{s.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 0508: 주소 슬롯은 플랜 전체 기준 — Day 탭을 넘겨도 카드 높이가 변하지 않게. */}
      <PlanTimeline
        items={timeline}
        currency={currency}
        showAmount={false}
        reserveAddressSlot={spots.some((s) => !!s.address)}
      />

      {/* 왕복 항공편 — 왕복 총액은 제목 옆에 한 번만(같은 열엔 같은 종류의 값) */}
      {publicFlight && (
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">왕복 항공편</p>
            <p className="text-[11px] text-muted">조회 시점 기준</p>
          </div>
          <PublicFlightTable data={publicFlight} />
        </div>
      )}

      {/* 예상 비용 */}
      {summary.ratios.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">예상 비용</p>
          <PublicCostSection summary={summary} headcount={headcount} startDate={startDate} endDate={endDate} />
        </div>
      )}

      <div className="mt-4">
        <Link href="/plan-finder" className="text-sm text-muted hover:text-fg transition-colors">
          ← 목록으로
        </Link>
      </div>
    </div>
  );
}
