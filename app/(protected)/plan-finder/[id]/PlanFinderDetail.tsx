'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PublicCostSection } from '@/app/(protected)/story/[id]/PublicCostSection';
import { openNaverDirections } from '@/lib/naver/directionsUrl';
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
  publicFlight,
  summary,
  currency,
  authorNickname,
  authorAvatarUrl,
  isOwner,
}: Props) {
  const [selectedDay, setSelectedDay] = useState(1);

  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  // 0513: 그날 항목 — order순 한 줄 행 목록(번호는 그날 안에서 연속).
  const dayItems = spots
    .filter((s) => s.day === selectedDay)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // 0494/0496: 그날 촬영지 사진 그리드 — 커버 있는 항목 전부, order순.
  //   0496: 히어로 디둡 제거 — 히어로=코스 인상 / 그리드=그날 동선 목록이라 역할이 달라 겹쳐도 중복 아님.
  //   (첫 장소가 히어로와 같아도 빼면 "그날 안 가나?" 오해가 더 커 디둡보다 손해.)
  const dayPhotos = spots
    .filter((s) => s.day === selectedDay && s.coverUrl)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const durationLabel = dayCount > 1 ? `${dayCount - 1}박 ${dayCount}일` : '당일';

  const actionButtons = (
    <div className="flex items-center gap-2 shrink-0">
      {/* 0515: 모바일은 하단 고정 바가 담기를 담당(시안 4d) — 인라인 버튼은 sm+ 전용 */}
      {!isOwner && (
        <span className="max-sm:hidden">
          <CopyPlanFinderButton planId={planId} />
        </span>
      )}
      <PlanLikeButton planId={planId} initialLiked={initialLiked} initialCount={initialCount} />
    </div>
  );

  return (
    // 0515: 담기 고정 바(모바일)가 마지막 내용을 가리지 않게 하단 여백 88px(시안 4d).
    <div className={isOwner ? undefined : 'max-sm:pb-[88px]'}>
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

      {/* 0515: 모바일 날짜 탭 — 전폭 한 줄 가로 스크롤 + 오른쪽 페이드(시안 4d). 데스크톱은 기존 그대로. */}
      <div className="relative mb-6">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 max-sm:pr-6">
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
              {/* 0511: 비용 섹션(0505)과 동일 포맷 — Day N 병기 없이 날짜만(세 화면 통일). startDate 없으면 방어 폴백 */}
              {startDate ? formatDayLabel(addDays(startDate, d - 1)) : `Day ${d}`}
            </button>
          ))}
        </div>
        <div
          aria-hidden
          className="sm:hidden absolute right-0 top-0 bottom-1 w-[34px] bg-gradient-to-r from-transparent to-bg pointer-events-none"
        />
      </div>

      {/* 0513: 그날 촬영지 사진 줄 — 항목 목록과 분리, 150px 고정 폭 가로 스크롤(시안 4a).
          0장이면 줄 생략(0494 유지). */}
      {dayPhotos.length > 0 && (
        <div className="mb-[22px]">
          <div className="flex gap-2.5 overflow-x-auto pb-[2px]">
            {dayPhotos.map((s) => (
              <div key={s.id} className="relative w-[150px] h-[104px] shrink-0 rounded-[6px] overflow-hidden">
                <Image src={s.coverUrl!} alt="" fill sizes="150px" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(10,12,13,0.72)] to-transparent px-[9px] pt-[18px] pb-2">
                  <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#a2a8ac]">이 날 촬영지 중 사진이 있는 {dayPhotos.length}곳</p>
        </div>
      )}

      {/* 0513: 일정 항목 — 회색 패널·흰 카드 제거, 한 줄 행 + hairline 구분(시안 4a).
          아이콘은 주소 유무로만 갈림(주소 있음 ◉ / 주소 없는 이동 기록 →).
          PlanTimeline은 소유자 뷰 전용으로 무접촉. */}
      <div className="mb-6 flex flex-col">
        {dayItems.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">항목이 없습니다.</p>
        ) : (
          dayItems.map((s, i) => {
            // 0502: 출발지 = 그날 order상 직전 항목(좌표 있을 때만) — 길찾기 링크에 승계.
            const prev = i > 0 ? dayItems[i - 1] : null;
            const origin =
              prev && prev.lat != null && prev.lng != null
                ? { name: prev.name, lat: prev.lat, lng: prev.lng }
                : undefined;
            return (
              <div
                key={s.id}
                className="grid grid-cols-[22px_16px_1fr] sm:grid-cols-[26px_18px_1fr] gap-2.5 sm:gap-3 items-baseline py-[13px] sm:py-[14px] border-b border-[#f1f2f3]"
              >
                <span className="text-xs sm:text-[13px] font-bold text-[#b3b9bd]">{i + 1}</span>
                <span
                  className={`text-center text-[#b3b9bd] ${
                    s.address ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-[13px]'
                  }`}
                >
                  {s.address ? '◉' : '→'}
                </span>
                <span className="flex flex-col gap-[5px] sm:gap-1 min-w-0">
                  <span className="flex items-center gap-[7px] sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                    <span
                      className={`text-[15px] sm:text-base break-keep ${
                        s.address ? 'font-semibold text-fg' : 'font-medium text-fg2'
                      }`}
                    >
                      {s.name}
                    </span>
                    {s.movie && (
                      <span className="shrink-0 px-[7px] py-[2px] sm:px-2 sm:py-[3px] rounded-[3px] bg-[#eaf3ff] text-[#2f7fe0] text-[11px] font-semibold">
                        {s.movie}
                      </span>
                    )}
                  </span>
                  {s.address &&
                    (s.lat != null && s.lng != null ? (
                      <button
                        type="button"
                        onClick={() =>
                          openNaverDirections({ name: s.name, lat: s.lat!, lng: s.lng! }, origin)
                        }
                        aria-label={`${s.name} 네이버 지도 길찾기`}
                        className="inline-flex max-w-full items-center gap-1 sm:gap-[5px] text-left text-xs sm:text-[13px] text-muted hover:text-[#2f7fe0] transition-colors min-h-[44px] -my-[13px] sm:min-h-0 sm:my-0"
                      >
                        <span className="truncate">{s.address}</span>
                        <span className="text-[10px] sm:text-[11px] shrink-0">↗</span>
                      </button>
                    ) : (
                      <p className="text-xs sm:text-[13px] text-muted truncate">{s.address}</p>
                    ))}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 예상 비용 — 0516: 시안 4a 순서(일정→비용→항공). 총액이 지표 밴드에 나오므로 비용이 이어받음 */}
      {summary.ratios.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">예상 비용</p>
          <PublicCostSection summary={summary} headcount={headcount} startDate={startDate} endDate={endDate} />
        </div>
      )}

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

      <div className="mt-4">
        <Link href="/plan-finder" className="text-sm text-muted hover:text-fg transition-colors">
          ← 목록으로
        </Link>
      </div>

      {/* 0515: 모바일 담기 하단 고정 바(시안 4d) — 본인 플랜은 바 자체가 없음(시안 4f).
          iOS 홈바 대응: pb에 safe-area 합산(CLAUDE.md §5). z-50 — 탭바(z-40) 위. */}
      {!isOwner && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/[.94] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <CopyPlanFinderButton planId={planId} variant="bar" />
        </div>
      )}
    </div>
  );
}
