'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Info } from 'lucide-react';
import { PublicCostSection } from '@/app/(protected)/story/[id]/PublicCostSection';
import { openNaverDirections } from '@/lib/naver/directionsUrl';
import { PublicFlightTable } from './PublicFlightTable';
import { PlanLikeButton } from './PlanLikeButton';
import { CopyPlanFinderButton, CopyPlanConfirmSheet } from './CopyPlanFinderButton';
import { PlanPublicToggle, PlanManageIcons } from '@/app/(protected)/my-plan/[id]/PlanOwnerActions';
import type { FlightLegData } from '@/app/(protected)/my-plan/_components/FlightLeg';
import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { formatDayLabel, addDays, formatDurationLabel } from '@/lib/plan/format-day-label';
import { formatAmount } from '@/app/(protected)/my-plan/_lib/cost';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { DayTabs } from '@/app/(protected)/_components/DayTabs';
import {
  COPIED_PLAN_COST_NOTICE_TITLE,
  COPIED_PLAN_COST_NOTICE_BODY,
} from '@/lib/plan/copied-plan-notice';

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
  // 0594: 담은 뒤 비용 총액이 그대로인가 — **서버에서 판정한 결과만** 받는다.
  //   판정 규칙·근거는 lib/plan/cost-snapshot.ts, 계산은 page.tsx.
  isCostUnchanged: boolean;
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
  isCostUnchanged,
}: Props) {
  const [selectedDay, setSelectedDay] = useState(1);
  // 0605: 결제 확인 시트의 열림 상태. **트리거가 2개**(데스크톱 인라인·모바일 바)인데 둘 다
  //   마운트되므로(CSS로만 가림) 상태를 버튼 안에 두면 시트가 2벌 생긴다 → 호스트가 갖는다.
  const [confirming, setConfirming] = useState(false);

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
          <CopyPlanFinderButton onRequest={() => setConfirming(true)} />
        </span>
      )}
      <PlanLikeButton planId={planId} initialLiked={initialLiked} initialCount={initialCount} />
    </div>
  );

  return (
    // 0515: 담기 고정 바(모바일)가 마지막 내용을 가리지 않게 하단 여백 88px(시안 4d).
    // 0605: 0604에서 116으로 늘렸다가 원복 — 가격 보조 문구가 시트로 흡수돼 바가 다시
    //   버튼 한 줄이 됐다. 실높이(safe-area 제외) = border-t 1 + pt-3 12 +
    //   버튼(py14×2 + 15×1.5)=50.5 + pb 12 = 75.5, 여유 12.5를 얹어 88.
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
            (소유자 상세 동형) — 버튼군과 공존 시 모바일 넘침 방지.
            0574: **소유자만 모바일 2줄로 접는다** — 360에서 [왼쪽 최소 123 + gap 20 +
            버튼군 218] = 361px이 콘텐츠 312px를 49px 넘겨 날짜가 공개 pill 위로 겹쳐 그려졌다.
            겹침의 원인은 절대 위치도 음수 마진도 아니다: 왼쪽 그룹에 `min-w-0`이 있어 **박스는
            0까지 줄어드는데** 안의 날짜가 `shrink-0`이라 안 줄고, `overflow-hidden`이 없어
            내용이 박스 밖으로 새어 오른쪽 그룹 위를 덮었다. 0559 주석의 "min-w-0 = 넘침 방지"는
            안쪽에 shrink-0이 있으면 성립하지 않는다 — 그래서 `overflow-hidden`을 함께 보강한다.
            비소유자는 손대지 않는다: 버튼이 좋아요뿐이라 199px < 312로 여유가 있고, 좋아요의
            우측 상단 자리는 시안 4a(♥ 자리) 판정이다 — 문제 없는 쪽을 건드리지 않는다.
            0574 후속: 구 조판(액션 4개가 2행에 좌측 정렬로 뭉침)은 오른쪽 94px이 비었다.
            **각 행이 양끝을 쓰도록** 재배치 — 1행 [메타 … 수정·삭제] / 2행 [pill … 좋아요].
            1행은 스토리 상세(/story/[id])와 같은 형태다(좌측 메타 + 우측 끝 관리 아이콘).
            데스크톱은 두 행 컨테이너가 그대로 [좌측 메타] / [pill·수정·삭제·좋아요]가 되어
            **간격까지 무변**(구 gap-2 중첩과 같은 8px). */}
        <div
          className={`${
            isOwner
              ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5'
              : 'flex items-center justify-between gap-5'
          }${coverUrl ? '' : ' mt-2'}`}
        >
          {/* 1행(모바일) / 좌측(데스크톱) */}
          <div className="flex items-center gap-2 text-[13px] sm:text-sm text-muted min-w-0 overflow-hidden">
            <AuthorAvatar nickname={authorNickname} avatarUrl={authorAvatarUrl} />
            <span className="text-fg font-semibold truncate">{authorNickname}</span>
            <span className="opacity-40">·</span>
            <span className="shrink-0">{createdAtLabel}</span>
            {/* 모바일 전용 사본 — 아이콘은 렌더 후 이탈(수정=이동, 삭제=redirect)뿐이라
                두 번 그려도 상태가 갈리지 않는다. **토글은 절대 복제하지 않는다**(optimistic
                상태가 갈림) — 그래서 pill은 2행에만 한 번 있다. */}
            {isOwner && <PlanManageIcons planId={planId} className="ml-auto sm:hidden" />}
          </div>
          {(isOwner || coverUrl) && (
            /* 2행(모바일) / 우측 묶음(데스크톱) */
            <div className="flex items-center gap-2 sm:shrink-0">
              {isOwner && <PlanPublicToggle planId={planId} isPublic={isPublic} />}
              {isOwner && <PlanManageIcons planId={planId} className="max-sm:hidden" />}
              {coverUrl && <div className="ml-auto sm:ml-0">{actionButtons}</div>}
            </div>
          )}
        </div>

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
            0574: **0562(B)의 "모바일에서도 4열 유지"를 뒤집는다 → 모바일 2×2 균등.**
              번복 근거: 0562(B)의 검산 대상이 **"가로로 넘치는가"뿐이었고 "격자로 읽히는가"는
              판정 대상이 아니었다.** 구 분배(앞 3칸 auto + 총 비용 1fr)는 넘치진 않았지만
              앞 3칸이 콘텐츠 폭으로 뭉치고(기간 72·장소 43·인원 34) 마지막 칸만 139px로 넓어
              네 칸이 격자로 안 읽혔다 — 실화면에서 "왼쪽으로 몰려 오른쪽이 빈다"로 관측.
              4열 균등은 불가: 360에서 칸당 72px인데 ₩1,460,000(7자리)이 ≈81px, 8자리는 ≈90px라
              넘친다(공백이 없어 줄바꿈도 안 됨 → 가로 스크롤). 값 폰트를 13px까지 낮춰도 경계라
              **2×2가 유일한 성립안**이다 — 칸당 (312−8)/2 = 152px, 8자리 90px에 여유 62px.
              대가: 모바일 밴드 세로 +55px(2행). 폼도 같은 밴드라 함께 바꾼다.
              데스크톱(sm+)은 `grid-cols-4` = repeat(4, minmax(0,1fr))로 **이미 균등**이라
              트랙 무변 — 0516의 균등 판정이 유효한 구간은 안 건드린다(마지막 칸 정렬만 추가).
            0562(C): 작성 폼(MyPlanNewForm)이 **같은 형태의 밴드**를 제목 아래에 둔다 —
              한쪽만 바꾸면 "저장하면 이 모습"이 어긋난다. 컴포넌트는 공유하지 않고(0556)
              조판 리터럴을 준용하므로 열 분배·gap·py·border·글자 등급을 양쪽 같이 고칠 것. */}
        <div className="mt-[14px] sm:mt-[22px] grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3 sm:gap-y-0 py-[14px] sm:py-5 border-t border-b border-border">
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
          {/* 0574: 총 비용만 sm+ 우측 정렬 — 균등 4열에서 마지막 칸 값이 칸(209px)보다
              짧아 밴드 오른쪽 끝이 100px 가까이 비어 보였다. 금액은 성격이 다른 값이라
              정렬선이 갈려도 된다(사용자 확정).
              **모바일은 좌측 정렬 유지** — 2×2의 오른쪽 열이 [장소 / 총 비용]이라
              여기만 우측으로 붙이면 같은 열 안에서 정렬이 갈린다(62px 빈 자리보다 큰 대가). */}
          <div className="flex flex-col gap-[3px] sm:gap-1 sm:items-end sm:text-right">
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
        <SectionHeader title="여행 일정" />
      </div>

      {/* 0515: 모바일 날짜 탭 — 전폭 한 줄 가로 스크롤 + 오른쪽 페이드(시안 4d). 데스크톱은 기존 그대로.
          0565: 공용 DayTabs로 추출(렌더 무변) — 같은 화면 비용 섹션이 같은 탭을 쓴다.
          여백(mt-4 mb-6)은 컴포넌트가 아니라 여기 — 섹션 간 조판은 호출부 책임(SectionHeader 선례③). */}
      <div className="mt-4 mb-6">
        <DayTabs
          days={days}
          selected={selectedDay}
          onSelect={setSelectedDay}
          // 0511: 비용 섹션(0505)과 동일 포맷 — Day N 병기 없이 날짜만(세 화면 통일). startDate 없으면 방어 폴백
          label={(d) => (startDate ? formatDayLabel(addDays(startDate, d - 1)) : `Day ${d}`)}
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
          <SectionHeader title="예상 비용" />
          {/* 0579: 담은 플랜의 금액은 원본 작성 시점 값이다(비용·항공 복사 개시 — actions.ts 주석).
              편집 폼(MyPlanNewForm)과 같은 문구·조판·조건.
              0593: 조건을 비공개 한정으로 좁혔다. 그때 확정된 것은 **배너의 목적**이다 —
              출처 표시가 아니라 담은 사람에게 확인을 요청하는 안내.
              0594: 그런데 **기준이 틀렸다**. 공개 여부는 금액이 낡았는지와 무관하다.
              사라져야 하는 시점은 **금액을 실제로 고쳤을 때**다. 그래서 `!isPublic`을 버리고
              담은 시점 스냅샷(MyPlan.sourceCostTotal) 대조로 바꿨다 —
              판정은 서버가 하고 여기는 결과(isCostUnchanged)만 쓴다.
              규칙·근거(총액 비교인 이유, 라이브 비교를 안 쓰는 이유)는 lib/plan/cost-snapshot.ts.
              `isOwner`는 유지한다: "확인 바랍니다"는 담은 사람에게 하는 요청이라, 공개된 담은
              플랜을 남이 볼 때는 할 일이 없는 사람에게 하는 말이 된다(0592 원본 링크와 같은 결).
              **편집 폼은 `isOwner` 없이 같은 판정을 쓴다** — 폼은 소유자만 진입하므로
              조건 문자열은 갈리지만 의미는 같다. */}
          {/* 0580~0590 경위: hint(회색) → warning(주황 글씨) → 경고 면 배너.
              0597: **경고 면 폐기 → 중립 안내 블록**. 두 가지가 문제였다.
              ① 이 화면은 전체가 **선과 여백만으로 구획**되는데 여기만 채워진 면이라
                 "혼자 다른 재질"로 읽혔다. ② 색이 경고(amber)인데 **내용은 경고가 아니라 안내**다.
              면은 중립 회색으로: 라이트 surface2(#e8e8ee) / 다크 fill1(#24282e).
              **한 유틸로는 두 모드 값을 동시에 못 낸다** — 그래서 dark: 변형으로 토큰을 갈아
              끼운다. 모드별로 다른 토큰을 쓰는 선례가 이미 있다
              (Footer의 `bg-popover dark:bg-bg-deep` — 0597 grep 실측 dark: 70건).
              다크 #24282e는 배경 bg-deep(#0f1112) 대비 1.278:1 — warningSurface 다크(1.272)·
              dangerSurface 다크(1.272)와 사실상 같아 현행과 동등한 가시성이다(0597 실측).
              0598: 라이트를 hairline(#f1f2f3) → surface2로 한 단 올렸다. hairline은 배경
              bg-deep(#f6f6f8) 대비 **1.038:1**이라 실화면에서 면이 안 보였다(선용 토큰을 면에
              쓴 셈). surface2는 1.131:1이고 **무채(r=g)라 배경과 같은 계열이 유지**된다 —
              fill1(1.159:1)은 대비가 더 높지만 r<g<b 푸른기가 무채 배경 위에서 다른 종류로 튄다
              (fill1을 쓰면 dark: 변형이 사라지는 이점이 있었으나 그 이유로 기각).
              fieldBorder(1.206:1)는 입력 테두리용이라 면으로 쓰면 토큰 하이재킹이다.
              면이 진해지면 그 위 글자·아이콘 대비는 내려간다 — 제목 14.27:1 / 설명 5.99:1(AA
              충족) / 아이콘 3.29:1(비텍스트 3:1 충족). fill2(1.510:1)는 설명이 4.49:1로 AA를
              깨서 후보에서 빠졌다.
              문구는 제목(할 일)·설명(왜) 2단 — 상수 정본은 lib/plan/copied-plan-notice.ts.
              편집 폼(MyPlanNewForm)과 **조판 리터럴 준용, 문구는 공유** — 조판은 한쪽만 바꾸면 갈린다. */}
          {isOwner && sourcePlanId && isCostUnchanged && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface2 dark:bg-fill1 px-3 py-2.5">
              {/* 0597: 경고(amber) → primary 계열 정보 아이콘. 라이트 #2f7fe0는 토큰이 아니라
                  리터럴이다 — 같은 값을 가진 토큰은 chipMovieFg(작품 칩 전용)뿐이라 그걸 쓰면
                  작품 칩 색을 바꿀 때 이 아이콘이 딸려 바뀐다(의미 없는 결합). primary 단독은
                  라이트 면에서 2.45:1로 비텍스트 3:1 미달이라 못 쓴다. 전용 토큰 신설은 이번
                  범위 밖(별건) — 그때까지 리터럴 + 이 주석. 다크는 primary 그대로(5.40:1). */}
              <Info aria-hidden size={17} className="mt-[1px] shrink-0 text-[#2f7fe0] dark:text-primary" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-fg break-keep">
                  {COPIED_PLAN_COST_NOTICE_TITLE}
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-fg2 break-keep">
                  {COPIED_PLAN_COST_NOTICE_BODY}
                </p>
              </div>
            </div>
          )}
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
      {/* 0591: 세로 스택(flex-col gap-2) → 좌우 분리. 두 링크는 **성격이 다르다** —
          "← 목록으로"는 되돌아가기, "원본 플랜 보기 →"는 새 대상으로의 전진인데, 같은 크기·
          색·굵기로 세로로 붙어 있어 화살표 방향 말고는 구분이 없었다. 좌우로 나누면 방향이
          위치로도 표현된다(뒤로=좌 / 앞으로=우).
          구 조판은 조판 판단의 결과가 아니었다 — 0103에서 링크 하나였던 자리에 원본 링크를
          얹으며 `mt-4` → `mt-4 flex flex-col gap-2`가 됐고, 0560 라우트 통합은 그대로 이식만
          했다(0591 조사: `-S"원본 플랜 보기"` 전체 이력 3커밋에 조판 판단 없음).
          **DOM 순서는 목록이 먼저**다 — 원본 링크는 조건부(아래 0592 주석)라 평소엔 없고,
          justify-between에서 자식이 하나면 그 자식이 좌측에 남는다. 0592로 조건이 하나 더
          좁아지면서(비공개 한정) 원본 링크가 없는 상태가 더 흔해졌다 — 순서 결정이 그만큼 중요.
          360px 검산: 본문 폭 312px(ProtectedMain px-6 = 24×2) vs 두 링크 ≈184px(text-sm 14px,
          한글 1em 기준) — 한 줄에 들어간다. 320px(272px)에서도 성립. nowrap은 걸지 않는다
          (넘칠 땐 줄바꿈이 가로 스크롤보다 낫다 — §5 리플로우). */}
      <div className="mt-7 sm:mt-10 flex items-center justify-between gap-3">
        <Link
          href={isOwner ? '/my-plan' : '/plan-finder'}
          className="text-sm text-muted hover:text-fg transition-colors"
        >
          ← 목록으로
        </Link>
        {/* 0592: 비공개일 때만. **공개하는 순간 독립된 플랜으로 본다** — 담아서 자기 일정으로
            고친 뒤 공개했다면 그건 그 사람의 플랜이고, 출처 링크가 계속 붙어 있으면 남에게
            "베낀 것"으로 읽힐 여지가 생긴다. 비공개 동안은 본인만 보므로 "어디서 담았더라"를
            되짚는 용도로 유효하다(그래서 isOwner 게이트와 짝).
            **DB의 sourcePlanId는 유지한다** — 담긴 횟수 집계·수익 배분에 쓸 연결이라
            데이터는 남기고 표시만 끈다. 저장 경로에서 끊지 말 것. */}
        {isOwner && sourcePlanId && !isPublic && (
          <Link
            href={`/plan-finder/${sourcePlanId}`}
            className="text-sm text-muted hover:text-fg transition-colors"
          >
            원본 플랜 보기 →
          </Link>
        )}
      </div>

      {/* 0515: 모바일 담기 하단 고정 바(시안 4d) — 본인 플랜은 바 자체가 없음(시안 4f).
          iOS 홈바 대응: pb에 safe-area 합산(CLAUDE.md §5). z-50 — 탭바(z-40) 위. */}
      {!isOwner && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/[.94] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <CopyPlanFinderButton onRequest={() => setConfirming(true)} variant="bar" />
        </div>
      )}

      {/* 0605: 확인 시트는 담기 바 **밖**, 루트의 마지막 자식으로 1개만.
          바 안에 있으면 (a) 데스크톱엔 바가 없어 시트를 못 쓰고 (b) 바의 `fixed z-50`이
          만드는 stacking context에 시트의 z-[70]이 갇힌다(0603 보고 건). */}
      {!isOwner && (
        <CopyPlanConfirmSheet
          planId={planId}
          open={confirming}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
