'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PublicCostSection } from '@/app/(protected)/story/[id]/PublicCostSection';
import { openNaverDirections } from '@/lib/naver/directionsUrl';
import { PublicFlightTable } from './PublicFlightTable';
import { PlanLikeButton } from './PlanLikeButton';
import { CopyPlanFinderButton } from './CopyPlanFinderButton';
import { PlanOwnerActions, PlanOwnerNotice } from '@/app/(protected)/my-plan/[id]/PlanOwnerActions';
import type { FlightLegData } from '@/app/(protected)/my-plan/_components/FlightLeg';
import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { formatDayLabel, addDays, formatDurationLabel } from '@/lib/plan/format-day-label';
import { formatAmount } from '@/app/(protected)/my-plan/_lib/cost';
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
  // 0559: 소유자 관리 버튼군(공개 전환 토글 초기 상태) — 비소유자 화면엔 미사용
  isPublic: boolean;
  // 0560: 담은 플랜의 원본 링크(구 PlanDetail 흡수) — isOwner일 때만 렌더
  sourcePlanId: string | null;
}

// 히어로 커버 sizes — 본문 컬럼 폭 기준(모바일 100vw, 데스크톱 = --reading-w 860).
// 0534: 구 640px은 0512 컬럼 시절 화석 — 0525 전폭(1232) 동안 저해상도 서빙 중이었다.
//   히어로를 860 컬럼 안에 넣으면서 실폭과 재동기.
const HERO_SIZES = '(max-width: 767px) 100vw, 860px';

// 0516: 섹션 제목(시안 4a/4d) — 22px(모바일 19px) 굵은 제목 + 2px 실선, 우측 보조.
//   섹션을 가르는 유일한 위계 장치라 세 섹션(일정·비용·항공) 공통.
// 0522: 공통 척도 — 섹션 제목 22px/700 자간 -0.02em, 보조는 보조 등급 14px.
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    // 0524: 2px 밑줄은 hairline보다 밝게(다크 #e7eaec) — 위계를 굵기가 아니라 밝기가 만든다
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-section-rule pb-2 sm:pb-2.5">
      <h2 className="text-[19px] sm:text-[22px] font-bold tracking-[-0.02em] text-fg break-keep">
        {title}
      </h2>
      {sub && <span className="text-xs sm:text-sm text-muted shrink-0">{sub}</span>}
    </div>
  );
}


// 0556: 일정 행 — 이 파일이 정본(0513 행 형태), 소유자 상세(PlanDetail)와 공용. 조판 무변 추출.
// trailing = 소유자 화면 전용 우측 슬롯(실값 금액) — 공개는 미전달, 행에 금액 없음 유지(0492).
export function PlanItemRow({
  item: s,
  index: i,
  origin,
  trailing,
}: {
  item: {
    id: string;
    name: string;
    coverUrl?: string | null;
    address?: string | null;
    movie?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  index: number;
  origin?: { name: string; lat: number; lng: number };
  trailing?: React.ReactNode;
}) {
  return (
              <div
                className="flex items-center gap-2.5 sm:gap-3 py-[13px] sm:py-[14px] border-b border-hairline"
              >
                {/* 0522: 공통 척도 보조 등급 14px */}
                <span className="w-[22px] shrink-0 text-xs sm:text-sm font-bold text-[#b3b9bd]">
                  {i + 1}
                </span>
                {s.coverUrl && (
                  <div className="relative w-[60px] h-[60px] shrink-0 rounded-[10px] overflow-hidden">
                    <Image src={s.coverUrl} alt="" fill sizes="60px" className="object-cover" />
                  </div>
                )}
                {/* 0520: md+는 [이름 ─ 주소(우측)] 한 줄 — 실데이터 최악 조합(이름 11자+주소
                    27자 ≈ 652px)이 md 콘텐츠 폭 720px에 들어감(sm 592px는 미달이라 2줄 유지).
                    이름은 온전(shrink-0), 주소가 남는 폭을 쓰고 넘치면 말줄임(표시만 — 링크는 전체). */}
                <span className="flex flex-col gap-[5px] sm:gap-1 min-w-0 flex-1 md:flex-row md:items-center md:gap-5">
                  <span className="flex items-center gap-[7px] sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap md:shrink-0">
                    <span
                      className={`text-[15px] sm:text-base break-keep ${
                        s.address ? 'font-semibold text-fg' : 'font-medium text-fg2'
                      }`}
                    >
                      {s.name}
                    </span>
                    {s.movie && (
                      // 0524: 다크는 옅은 파랑 면을 못 써 면·글자 반전(대비 6.89:1).
                      // 11px → 12px은 CLAUDE.md §5 "12px 미만 금지" 시정이라 라이트도 함께 올림.
                      <span className="shrink-0 px-[7px] py-[2px] sm:px-2 sm:py-[3px] rounded-[3px] bg-chip-movie-bg text-chip-movie-fg text-xs font-semibold">
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
                        className="inline-flex max-w-full items-center gap-1 sm:gap-[5px] text-left text-xs sm:text-sm text-muted hover:text-[#2f7fe0] transition-colors min-h-[44px] -my-[13px] sm:min-h-0 sm:my-0 md:flex-1 md:min-w-0 md:justify-end"
                      >
                        <span className="truncate">{s.address}</span>
                        <span className="text-[10px] sm:text-[11px] shrink-0">↗</span>
                      </button>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted truncate md:flex-1 md:min-w-0 md:text-right">{s.address}</p>
                    ))}
                </span>
                {trailing}
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
  isPublic,
  sourcePlanId,
}: Props) {
  const [selectedDay, setSelectedDay] = useState(1);

  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  // 0513: 그날 항목 — order순 한 줄 행 목록(번호는 그날 안에서 연속).
  const dayItems = spots
    .filter((s) => s.day === selectedDay)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // 0562(B): 문구 산출은 lib으로 승격(작성 폼과 한 벌 — format-day-label 주석 참조).
  //   날짜 미설정이면 "—" — page.tsx가 dayCount를 1로 폴백해 실제 당일치기와 구분되지 않으므로
  //   dayCount가 아니라 startDate·endDate 유무로 판정한다.
  const durationLabel =
    startDate && endDate ? formatDurationLabel(dayCount) : '—';

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
    // 0534: 읽기 화면 공용 본문 폭 --reading-w(860, 스토리 상세와 동일) — 히어로 포함 통째.
    //   히어로를 안에 넣는 근거: 스토리 상세 선례(썸네일 포함 전부 컬럼 안) + 히어로만 넓으면
    //   정렬선이 두 개가 돼 "한 화면 안 폭 갈림"이 히어로-본문 사이로 옮겨갈 뿐.
    //   860 성립 검산(0534 실측, Pretendard 폴백): 일정 행 652 / 비용 2열 한 칸 211(열폭 420)
    //   / 항공 4열 최장 482 — 전부 하한 위. 모바일 담기 고정 바(fixed inset-x-0)는
    //   max-w 래퍼의 containing block이 아니라 무영향.
    <div className={`max-w-[var(--reading-w)] mx-auto${isOwner ? '' : ' max-sm:pb-[88px]'}`}>
      {/* 0512: 히어로에 제목(좌하단)·지역 칩(좌상단) — 시안 4a/4d. 좌우 인셋은 시안 40px가
          전체 페이지 패딩 기준이라 컬럼 폭인 우리 히어로엔 기존 16px 유지. */}
      {coverUrl && (
        <div className="relative w-full h-[200px] sm:h-[300px] rounded-[14px] overflow-hidden mb-4">
          <Image src={coverUrl} alt="" fill sizes={HERO_SIZES} className="object-cover" />
          {/* 0524: 다크에서 제목 가독 — 사진 전체 베일 한 겹(라이트는 transparent라 무영향) +
              하단 스크림(다크 알파 0.92, 데스크톱 높이 160→220px) */}
          <div className="absolute inset-0 bg-hero-veil" />
          <div className="absolute inset-x-0 bottom-0 h-[130px] sm:h-[160px] sm:dark:h-[220px] bg-gradient-to-t from-hero-scrim to-transparent" />
          {region && (
            <span className="absolute left-4 top-[14px] sm:top-6 inline-flex items-center text-[11px] sm:text-xs leading-none font-semibold text-white bg-[rgba(15,17,18,0.62)] rounded px-[9px] py-1 sm:px-[11px] sm:py-[5px]">
              {region}
            </span>
          )}
          {/* 0522: 공통 척도 페이지 제목 28px/700 (0512 시안 실측 30px에서 하향). 모바일 22px 유지 */}
          <h1 className="absolute left-4 right-4 bottom-4 sm:bottom-[26px] text-[22px] leading-[1.3] sm:text-[28px] font-bold tracking-[-0.02em] text-white break-keep">
            {title}
          </h1>
        </div>
      )}

      <div className="mb-6">
        {/* 커버 없는 플랜은 기존대로 히어로 생략 — 제목·버튼 인라인 유지 */}
        {!coverUrl && (
          <div className="flex items-start justify-between gap-2">
            {/* 0522: 히어로 제목과 같은 페이지 제목 등급(28px/700 -0.02em). 모바일 24px 유지 */}
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.02em] text-fg break-keep">
              {title}
            </h1>
            {actionButtons}
          </div>
        )}

        {/* 메타 — 작성자·날짜, 커버 있으면 버튼을 우측에(시안 4a의 ♥ 자리).
            0559: 소유자면 관리 버튼군(공개 전환·수정·삭제) — 소유자 상세와 같은 자리(메타 행
            우측), 스토리 상세 방식(한 화면 + isOwner 게이트). 좌측은 min-w-0·truncate 보강
            (소유자 상세 동형) — 버튼군과 공존 시 모바일 넘침 방지. */}
        <div className={`flex items-center justify-between gap-5 ${coverUrl ? '' : 'mt-2'}`}>
          <div className="flex items-center gap-2 text-[13px] sm:text-sm text-muted min-w-0">
            <AuthorAvatar nickname={authorNickname} avatarUrl={authorAvatarUrl} />
            <span className="text-fg font-semibold truncate">{authorNickname}</span>
            <span className="opacity-40">·</span>
            <span className="shrink-0">{createdAtLabel}</span>
          </div>
          {(isOwner || coverUrl) && (
            <div className="flex items-center gap-2 shrink-0">
              {isOwner && <PlanOwnerActions planId={planId} isPublic={isPublic} />}
              {coverUrl && actionButtons}
            </div>
          )}
        </div>
        {isOwner && <PlanOwnerNotice />}

        {/* 커버 없을 때 지역 칩은 인라인으로 유지(작품 칩은 별도 트랙이라 제외) */}
        {!coverUrl && region && (
          <div className="mt-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-surface2 text-fg2 border border-border">
              {region}
            </span>
          </div>
        )}

        {/* 0512: 지표 밴드 — 요약 앵커 한 줄 대체, 위아래 구분선.
            0516: 칸이 본문 폭 균등 분배(각 칸 1fr) — 시안 4a는 max-content 뭉침형이나 지시 우선.
            0562(B): 3열 → **4열 고정**(기간·장소·인원·총 비용). 인원이 합류한 건 총액 옆
              "· N인"(구 PublicCostSection)을 걷어내고 인원을 지표의 한 칸으로 세우기 위함 —
              같은 값이 두 자리에 있던 것을 한 자리로.
              **모바일에서도 4열 유지**(2×2로 접지 않는다) — 작성 폼이 같은 밴드를 쓰므로
              형태가 갈리면 "저장하면 이 모습"이라는 예측이 깨진다.
            0562(B) 열 분배: 모바일만 비균등(앞 3칸 auto + 총 비용 1fr). 360px 실측 —
              콘텐츠 폭 312(px-6) − gap 24 = 288, 균등이면 칸당 72px인데 실데이터 최장
              ₩1,460,000이 16px bold로 ≈81px라 넘친다(공백이 없어 줄바꿈도 안 됨 → 가로 스크롤).
              앞 3칸을 콘텐츠 폭으로 두면(기간 55·장소 34·인원 24 = 113) 총 비용에 175px이 남는다.
              0516의 균등은 **3열일 때** 판정이고 4열은 새 조건 — 데스크톱(sm+, 칸당 209px)은
              균등 그대로라 기존 판정이 유효한 구간은 안 건드린다.
            0562(C): 작성 폼(MyPlanNewForm)이 **같은 형태의 밴드**를 제목 아래에 둔다 —
              한쪽만 바꾸면 "저장하면 이 모습"이 어긋난다. 컴포넌트는 공유하지 않고(0556)
              조판 리터럴을 준용하므로 열 분배·gap·py·border·글자 등급을 양쪽 같이 고칠 것. */}
        <div className="mt-[14px] sm:mt-[22px] grid grid-cols-[auto_auto_auto_1fr] sm:grid-cols-4 gap-x-2 py-[14px] sm:py-5 border-t border-b border-border">
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <span className="text-[11px] sm:text-xs sm:font-medium text-muted">기간</span>
            <span className="text-base sm:text-xl font-bold text-fg">{durationLabel}</span>
          </div>
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <span className="text-[11px] sm:text-xs sm:font-medium text-muted">장소</span>
            <span className="text-base sm:text-xl font-bold text-fg">{spots.length}곳</span>
          </div>
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <span className="text-[11px] sm:text-xs sm:font-medium text-muted">인원</span>
            <span className="text-base sm:text-xl font-bold text-fg">{headcount}인</span>
          </div>
          {/* 0562(B): 구 `summary.total > 0` 조건부 렌더 폐기 — 칸이 통째로 빠지면 남은 칸이
              늘어나 밴드 형태가 플랜마다 달라졌다. 값이 없을 때는 칸을 유지하고 "—"를 넣는다
              (장소 0곳·인원 1인은 실값이라 "—" 대상이 아니다 — 없는 게 아니라 0/기본값). */}
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <span className="text-[11px] sm:text-xs sm:font-medium text-muted">총 비용</span>
            <span className="text-base sm:text-xl font-bold text-fg tabular-nums">
              {summary.total > 0 ? formatAmount(summary.total, currency) : '—'}
            </span>
          </div>
        </div>

        {/* 0512: 소개문 — 회색 박스 제거, 본문 텍스트로.
            0520: break-keep(어절 단위 줄바꿈) 도입 — 이 부분은 유지.
            0525: 0520의 62ch·0521의 md+ 70ch 폭 제한을 폐기했었다 — 소개문**만** 좁으면
            전폭인 지표 밴드·일정·비용·항공 사이에서 왼쪽으로 쏠려 보였기 때문(실화면 검수).
            0534: 화면 **통째**를 --reading-w(860)로 제한하며 번복 — 0525의 문제는 "한 화면 안
            폭 갈림"이었지 폭 제한 자체가 아니었다. 이제 전 섹션이 같은 폭이라 쏠림이 재발하지
            않는다. 수용한 대가: 860에서 ≈54~62자/줄(1em 가정~폴백 실측)로 여전히 권장 대역
            30~40자 위 — 0525의 74자보다 30% 개선, 나머지는 0322 실판정(860) 우선으로 수용. */}
        {description && (
          <p className="mt-[14px] sm:mt-[22px] break-keep text-[15px] leading-[1.7] sm:text-base sm:leading-[1.75] text-fg2 text-pretty whitespace-pre-wrap">
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
            return <PlanItemRow key={s.id} item={s} index={i} origin={origin} />;
          })
        )}
      </div>

      {/* 예상 비용 — 0516: 시안 4a 순서(일정→비용→항공). 총액이 지표 밴드에 나오므로 비용이 이어받음.
          0562: 별도 "왕복 항공편" 섹션 폐기 — 항공은 비용 안의 형제 그룹(고정 비용 / 항공권 /
          일자별 비용)으로 편입. 0492가 "왕복 총액은 섹션 제목 옆에 한 번만"으로 잡았던 자리는
          그룹 헤더 summary로 이관 — 원칙(같은 값은 한 곳)은 그대로고 위치만 옮겼다.
          이로써 총액이 고정 비용 항목과 섹션 제목 두 곳에 나오던 중복이 해소되고, 제목이
          tripType 무관 "왕복 항공편"이라 편도에서 거짓이던 표기도 함께 사라진다.
          표는 슬롯으로 넘긴다(PublicCostSection이 plan-finder를 import하지 않게 — 그쪽 주석 참조). */}
      {summary.ratios.length > 0 && (
        <div className="mt-7 sm:mt-11">
          <SectionHeader title="예상 비용" sub="총액 기준 · 1인 환산 없음" />
          <div className="mt-[18px]">
            <PublicCostSection
              summary={summary}
              startDate={startDate}
              endDate={endDate}
              flight={
                publicFlight && {
                  tripType: publicFlight.tripType,
                  totalAmount: publicFlight.totalAmount,
                  table: <PublicFlightTable data={publicFlight} />,
                }
              }
            />
          </div>
        </div>
      )}

      {/* 0560: 상세 한 벌화(구 PlanDetail 하단 흡수) — 원본 링크는 소유자만(담은 플랜은
          비공개라 사실상 소유자만 열람하지만 게이트 명시). 목록은 진입 맥락 따라 분기 —
          소유자는 내 목록(/my-plan)에서 들어온다. */}
      <div className="mt-7 sm:mt-10 flex flex-col gap-2">
        {isOwner && sourcePlanId && (
          <Link
            href={`/plan-finder/${sourcePlanId}`}
            className="text-sm text-muted hover:text-fg transition-colors"
          >
            원본 플랜 보기 →
          </Link>
        )}
        <Link
          href={isOwner ? '/my-plan' : '/plan-finder'}
          className="text-sm text-muted hover:text-fg transition-colors"
        >
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
