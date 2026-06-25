'use client';
import { useState } from 'react';
import Link from 'next/link';
import { FlightLeg, type FlightLegData } from '@/app/(protected)/my-plan/_components/FlightLeg';
import { PlanTimeline, buildTimeline } from '@/app/(protected)/my-plan/_components/PlanTimeline';
import { PublicCostSection } from '@/app/story/[id]/PublicCostSection';
import { PlanLikeButton } from './PlanLikeButton';
import { CopyPlanFinderButton } from './CopyPlanFinderButton';
import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { AuthorAvatar } from '@/components/AuthorAvatar';

interface Props {
  planId: string;
  initialLiked: boolean;
  initialCount: number;
  title: string;
  description: string | null;
  region: string | null;
  movie: string | null;
  createdAtLabel: string;
  dayCount: number;
  spots: { id: string; day: number; name: string; order?: number }[];
  costCategories: { planSpotId: string | null; category: string }[];
  publicFlight: FlightLegData | null;
  summary: PublicCostSummary;
  currency: 'KRW' | 'USD' | 'JPY';
  authorNickname: string;
  authorAvatarUrl: string | null;
  isOwner: boolean;
}

export function PlanFinderDetail({
  planId,
  initialLiked,
  initialCount,
  title,
  description,
  region,
  movie,
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
  const timeline = buildTimeline(
    spots,
    costCategories.map((c) => ({ ...c, amount: 0 })),
    selectedDay,
  );

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{title}</h1>
          <div className="flex items-center gap-2">
            {!isOwner && <CopyPlanFinderButton planId={planId} />}
            <PlanLikeButton planId={planId} initialLiked={initialLiked} initialCount={initialCount} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
          <span>{createdAtLabel}</span>
          <span>·</span>
          <AuthorAvatar nickname={authorNickname} avatarUrl={authorAvatarUrl} />
          <span>{authorNickname}</span>
        </div>

        {(region || movie) && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {region && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {region}
              </span>
            )}
            {movie && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {movie}
              </span>
            )}
          </div>
        )}

        {description && (
          <div className="mt-3 glass-outer p-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">여행계획 간단소개</p>
            <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{description}</p>
          </div>
        )}
      </div>

      {publicFlight && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
            항공편 (예상)
          </p>
          <FlightLeg data={publicFlight} showDetails={false} />
        </div>
      )}

      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
        여행 일정
      </p>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedDay === d
                ? 'bg-[#1A1A1A] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Day {d}
          </button>
        ))}
      </div>

      <PlanTimeline items={timeline} currency={currency} showAmount={false} />

      <PublicCostSection summary={summary} />

      <div className="mt-4">
        <Link href="/plan-finder" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
          ← 목록으로
        </Link>
      </div>
    </div>
  );
}
