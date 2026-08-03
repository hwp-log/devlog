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
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { CARD_PILL_CLASS } from '@/lib/card-tokens';

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
  spots: { id: string; day: number; name: string; order?: number }[];
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

  const durationLabel = dayCount > 1 ? `${dayCount - 1}박 ${dayCount}일` : '당일';
  const anchor = [
    durationLabel,
    `장소 ${spots.length}곳`,
    `${headcount}인`,
    summary.total > 0 ? `총 ${formatApproxCost(summary.total, currency)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      {/* 히어로 — 커버 위에 지역 칩(목록 카드와 같은 좌상단 자리). 제목·요약은 아래로. */}
      {coverUrl && (
        <div className="relative w-full h-[170px] rounded-[14px] overflow-hidden mb-4">
          <Image src={coverUrl} alt="" fill sizes={HERO_SIZES} className="object-cover" />
          {region && (
            <span
              className={`absolute left-4 top-[13px] inline-flex items-center text-[11px] leading-none px-[9px] py-[3px] rounded-full ${CARD_PILL_CLASS}`}
            >
              {region}
            </span>
          )}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-fg break-keep">{title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            {!isOwner && <CopyPlanFinderButton planId={planId} />}
            <PlanLikeButton planId={planId} initialLiked={initialLiked} initialCount={initialCount} />
          </div>
        </div>

        {/* 요약 앵커 — 목록 카드(0441)와 같은 기준·표현 */}
        <p className="text-[13px] text-muted mt-1">{anchor}</p>

        {/* 메타 — 작성자·날짜 */}
        <div className="flex items-center gap-2 text-sm text-muted mt-2">
          <AuthorAvatar nickname={authorNickname} avatarUrl={authorAvatarUrl} />
          <span>{authorNickname}</span>
          <span>·</span>
          <span>{createdAtLabel}</span>
        </div>

        {/* 커버 없을 때 지역 칩은 인라인으로 유지(작품 칩은 별도 트랙이라 제외) */}
        {!coverUrl && region && (
          <div className="mt-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-surface2 text-fg2 border border-border">
              {region}
            </span>
          </div>
        )}

        {description && (
          <div className="mt-3 bg-card border border-border rounded-[14px] p-4">
            <p className="text-xs font-semibold text-muted mb-1">여행계획 간단소개</p>
            <p className="text-sm text-fg whitespace-pre-wrap">{description}</p>
          </div>
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
            Day {d}
          </button>
        ))}
      </div>

      <PlanTimeline
        items={timeline}
        currency={currency}
        showAmount
        amountPlacement="bottom"
        amountFormat="approx"
      />

      {/* 왕복 항공편 — 왕복 총액은 제목 옆에 한 번만(같은 열엔 같은 종류의 값) */}
      {publicFlight && (
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">왕복 항공편</p>
            <p className="text-[11px] text-muted">
              조회 시점 기준
              {publicFlight.totalAmount > 0 && ` · 왕복 ${formatApproxCost(publicFlight.totalAmount, currency)}`}
            </p>
          </div>
          <PublicFlightTable data={publicFlight} />
        </div>
      )}

      {/* 예상 비용 */}
      {summary.ratios.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">예상 비용</p>
          <PublicCostSection summary={summary} headcount={headcount} />
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
