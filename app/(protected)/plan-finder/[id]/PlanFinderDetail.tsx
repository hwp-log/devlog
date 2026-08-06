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

// 0516: 섹션 제목(시안 4a/4d) — 22px(모바일 19px) 굵은 제목 + 2px 실선, 우측 13px(12px) 보조.
//   섹션을 가르는 유일한 위계 장치라 세 섹션(일정·비용·항공) 공통.
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-fg pb-2 sm:pb-2.5">
      <h2 className="text-[19px] sm:text-[22px] font-bold tracking-[-0.015em] text-fg break-keep">
        {title}
      </h2>
      {sub && <span className="text-xs sm:text-[13px] text-muted shrink-0">{sub}</span>}
    </div>
  );
}

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

  const durationLabel = dayCount > 1 ? `${dayCount - 1}박 ${dayCount}일` : '당일';

  // 0516: 왕복 총액은 제목 옆 한 번(0492 원칙). 0518: 인라인 섹션 헤더와 우측 카드가 공유.
  const flightSub = publicFlight
    ? `조회 시점 기준${
        publicFlight.totalAmount > 0
          ? ` · ${publicFlight.tripType === 'ROUND_TRIP' ? '왕복 ' : ''}${formatApproxCost(publicFlight.totalAmount, currency)}`
          : ''
      }`
    : null;

  const actionButtons = (
    <div className="flex items-center gap-2 shrink-0">
      {/* 0515: 모바일은 하단 고정 바가 담기 담당. 0518: lg+는 우측 카드 버튼이 담당 — 인라인은 640~1023px만 */}
      {!isOwner && (
        <span className="max-sm:hidden lg:hidden">
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
        <div className="relative w-full h-[200px] sm:h-[300px] rounded-[14px] overflow-hidden mb-4">
          <Image src={coverUrl} alt="" fill sizes={HERO_SIZES} className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-[130px] sm:h-[160px] bg-gradient-to-t from-[rgba(10,12,13,0.74)] sm:from-[rgba(10,12,13,0.72)] to-transparent" />
          {region && (
            <span className="absolute left-4 top-[14px] sm:top-6 inline-flex items-center text-[11px] sm:text-xs leading-none font-semibold text-white bg-[rgba(15,17,18,0.62)] rounded px-[9px] py-1 sm:px-[11px] sm:py-[5px]">
              {region}
            </span>
          )}
          <h1 className="absolute left-4 right-4 bottom-4 sm:bottom-[26px] text-[22px] leading-[1.3] sm:text-[30px] font-bold tracking-[-0.02em] text-white break-keep">
            {title}
          </h1>
        </div>
      )}

      {/* 0518: 데스크톱 2열 — 좌 콘텐츠 1.55fr / 우 sticky 카드 1fr, gap 36px, 위 정렬
          (stretch 금지 — sticky와 양립 불가). lg 미만은 grid 미적용 = 기존 1열 흐름 그대로.
          브레이크포인트 lg: 카드 최소 280px이 md(768)에선 268px로 미달, lg(1024)에서 368px 확보. */}
      <div className="lg:grid lg:grid-cols-[1.55fr_1fr] lg:gap-9 lg:items-start">
      {/* 좌열 — 메타 → 소개문 → 일정 → (lg 미만 한정: 비용·항공) → 목록으로 */}
      <div>

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
          <div className="flex items-center gap-2 text-[13px] sm:text-sm text-muted">
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

        {/* 0512: 지표 밴드 3열(기간·장소·총 비용) — 요약 앵커 한 줄 대체, 위아래 구분선.
            0516: 세 칸이 본문 폭 균등 분배(각 칸 1fr) — 시안 4a는 max-content 뭉침형이나 지시 우선.
            0518: lg+는 폐기 — 기간·장소는 우측 카드 맨 위로, 총 비용은 카드 총액과 중복이라 삭제. */}
        <div className="mt-[14px] sm:mt-[22px] grid grid-cols-3 gap-x-2 py-[14px] sm:py-5 border-t border-b border-border lg:hidden">
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <span className="text-[11px] sm:text-xs sm:font-medium text-muted">기간</span>
            <span className="text-base sm:text-xl font-bold text-fg">{durationLabel}</span>
          </div>
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <span className="text-[11px] sm:text-xs sm:font-medium text-muted">장소</span>
            <span className="text-base sm:text-xl font-bold text-fg">{spots.length}곳</span>
          </div>
          {summary.total > 0 && (
            <div className="flex flex-col gap-[3px] sm:gap-1">
              <span className="text-[11px] sm:text-xs sm:font-medium text-muted">총 비용</span>
              <span className="text-base sm:text-xl font-bold text-fg">
                {formatApproxCost(summary.total, currency)}
              </span>
            </div>
          )}
        </div>

        {/* 0512: 소개문 — 회색 박스 제거, 본문 텍스트로.
            0518: max-w-[720px] 제거 — 2열에선 좌열 폭이 제한 역할 */}
        {description && (
          <p className="mt-[14px] sm:mt-[22px] text-[15px] leading-[1.7] sm:text-base sm:leading-[1.75] text-fg2 text-pretty whitespace-pre-wrap">
            {description}
          </p>
        )}
      </div>

      {/* 여행 일정 — 0516: 시안 헤더(소개문 뒤 40px = 상단부 mb-6 + mt-4) */}
      <div className="mt-4">
        <SectionHeader title="여행 일정" sub="작성자가 넣은 순서" />
      </div>

      {/* 0515: 모바일 날짜 탭 — 전폭 한 줄 가로 스크롤 + 오른쪽 페이드(시안 4d). 데스크톱은 기존 그대로. */}
      <div className="relative mt-4 mb-6">
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

      {/* 0513: 일정 항목 — 회색 패널·흰 카드 제거, 한 줄 행 + hairline 구분.
          0517: 별도 사진 줄(150px, 0513) 폐기 — 사진 1장일 때 우측이 통째로 비는 문제.
          커버 있는 항목만 행 왼쪽 60px 썸네일, 없으면 열 자체 생략(플레이스홀더 금지).
          아이콘 열(◉/→)도 제거 — 구조는 번호(22px)+[썸네일]+이름·주소.
          번호는 사진 유무 무관 그날 순번 연속. PlanTimeline은 소유자 뷰 전용으로 무접촉. */}
      <div className="flex flex-col">
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
                className="flex items-center gap-2.5 sm:gap-3 py-[13px] sm:py-[14px] border-b border-[#f1f2f3]"
              >
                <span className="w-[22px] shrink-0 text-xs sm:text-[13px] font-bold text-[#b3b9bd]">
                  {i + 1}
                </span>
                {s.coverUrl && (
                  <div className="relative w-[60px] h-[60px] shrink-0 rounded-[10px] overflow-hidden">
                    <Image src={s.coverUrl} alt="" fill sizes="60px" className="object-cover" />
                  </div>
                )}
                <span className="flex flex-col gap-[5px] sm:gap-1 min-w-0 flex-1">
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

      {/* 예상 비용 — 0516: 시안 4a 순서(일정→비용→항공). 0518: lg+는 우측 카드가 담당 — 인라인은 <lg 전용 */}
      {summary.ratios.length > 0 && (
        <div className="mt-7 sm:mt-11 lg:hidden">
          <SectionHeader title="예상 비용" sub="총액 기준 · 1인 환산 없음" />
          <div className="mt-[18px]">
            <PublicCostSection summary={summary} headcount={headcount} startDate={startDate} endDate={endDate} />
          </div>
        </div>
      )}

      {/* 왕복 항공편 — 왕복 총액은 제목 옆에 한 번만(같은 열엔 같은 종류의 값, 0492 원칙 복원).
          0518: lg+는 우측 카드가 담당 — 인라인은 <lg 전용 */}
      {publicFlight && (
        <div className="mt-7 sm:mt-11 lg:hidden">
          <SectionHeader title="왕복 항공편" sub={flightSub ?? undefined} />
          <PublicFlightTable data={publicFlight} />
        </div>
      )}

      <div className="mt-7 sm:mt-10">
        <Link href="/plan-finder" className="text-sm text-muted hover:text-fg transition-colors">
          ← 목록으로
        </Link>
      </div>

      </div>{/* 좌열 끝 */}

      {/* 0518: 우측 sticky 카드 — 담기(flex-none, 항상 보임) + 회색 카드(넘칠 때만 내부 스크롤).
          top 73px = 헤더 57px(h-14+0.5px border, 0485 계측) + 16px. transition·애니메이션 금지.
          일정 목록은 내부 스크롤 없음 — 페이지 스크롤 유지. */}
      <aside className="hidden lg:flex lg:flex-col lg:gap-3 lg:sticky lg:top-[73px] lg:max-h-[calc(100vh-89px)]">
        {!isOwner && (
          <div className="flex-none">
            <CopyPlanFinderButton planId={planId} variant="bar" />
          </div>
        )}
        <div className="min-h-0 overflow-y-auto bg-[#f7f8f9] rounded-[14px] px-5 py-[18px]">
          {/* 기간/장소 — 전폭 지표 밴드 대체. 총 비용은 아래 총액과 중복이라 제외(단일 표기) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">기간</span>
              <span className="text-[17px] font-bold text-fg">{durationLabel}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">장소</span>
              <span className="text-[17px] font-bold text-fg">{spots.length}곳</span>
            </div>
          </div>

          {summary.ratios.length > 0 && (
            <>
              <div aria-hidden className="my-4 border-t border-border" />
              {/* 카드 안 위계 — 22px 제목·2px 밑줄 금지(카드가 두 덩이로 쪼개져 보임) */}
              <p className="text-[15px] font-bold text-fg">예상 비용</p>
              <div className="mt-2">
                <PublicCostSection
                  variant="card"
                  summary={summary}
                  headcount={headcount}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            </>
          )}

          {publicFlight && (
            <>
              <div aria-hidden className="my-4 border-t border-border" />
              <p className="text-[15px] font-bold text-fg">왕복 항공편</p>
              {flightSub && <p className="mt-0.5 text-xs text-muted">{flightSub}</p>}
              <div className="mt-3">
                <PublicFlightTable data={publicFlight} variant="stacked" />
              </div>
            </>
          )}
        </div>
      </aside>

      </div>{/* 2열 grid 끝 */}

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
