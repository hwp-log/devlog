import Link from 'next/link';
import Image from 'next/image';
import { Heart, Lock, Globe, PencilLine, ImagePlus } from 'lucide-react';
import { formatAmount } from '../_lib/cost';
import {
  CARD_PILL_CLASS,
  CARD_COVER_OVERLAY,
  CARD_TEXT_SHADOW,
  CARD_FALLBACK_BG,
  PLAN_CARD_SIZES,
} from '@/lib/card-tokens';
import { MyPlanCardMenu } from './MyPlanCardMenu';

type Currency = 'KRW' | 'USD' | 'JPY';

interface MyPlanCardProps {
  id: string;
  title: string;
  region: string | null;
  movie: string | null;
  coverUrl: string | null;
  currency: Currency;
  startDate: Date | null;
  endDate: Date | null;
  spotCount: number;
  headcount: number;
  total: number;
  isPublic: boolean;
  isDraft: boolean;
  likeCount: number;
}

/** 카드 기간 — "10.12~10.14", 하루면 "09.28". 시작일 없으면 세그먼트 자체를 뺀다. */
function formatCardPeriod(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const md = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  if (!end || end.getTime() === start.getTime()) return md(start);
  return `${md(start)}~${md(end)}`;
}

// 상태 칩 — 색은 "공개"에만. 채움(공개) > 기본 재질(비공개) > 점선(초안)의 무게 3단이라
// 상태 언어가 색으로 경쟁하지 않는다(CLAUDE.md §9). isDraft가 isPublic보다 우선(미완성이 먼저 읽혀야 함).
// 공개 칩만 primary 면 — primary-fg(#0b1a2b)는 파랑 위 6.39:1(0524).
const CHIP_BASE =
  'inline-flex items-center gap-1 shrink-0 text-[11px] leading-none px-[9px] py-[4px] rounded-full';
const PUBLIC_CHIP = 'bg-primary text-primary-fg font-semibold';
// 초안 — 투명 점선. 라이트 커버(밝은 사진)에서 흰 점선이 날아가지 않도록 어두운 면을 깔아준다.
const DRAFT_CHIP =
  'border border-dashed border-white/60 text-white bg-[rgba(10,10,16,0.34)]';

function StateChip({ isPublic, isDraft }: { isPublic: boolean; isDraft: boolean }) {
  if (isDraft) {
    return (
      <span className={`${CHIP_BASE} ${DRAFT_CHIP}`}>
        <PencilLine size={11} />
        초안
      </span>
    );
  }
  if (isPublic) {
    return (
      <span className={`${CHIP_BASE} ${PUBLIC_CHIP}`}>
        <Globe size={11} />
        공개
      </span>
    );
  }
  return (
    <span className={`${CHIP_BASE} ${CARD_PILL_CLASS}`}>
      <Lock size={11} />
      비공개
    </span>
  );
}

export function MyPlanCard({
  id,
  title,
  region,
  movie,
  coverUrl,
  currency,
  startDate,
  endDate,
  spotCount,
  headcount,
  total,
  isPublic,
  isDraft,
  likeCount,
}: MyPlanCardProps) {
  // 메타 한 줄 — 지역은 칩으로 올라갔으므로 여기선 작품이 앞. 작품이 없을 때만 지역으로 대체
  // (플랜파인더는 지역을 칩·메타에 두 번 쓰지만, 소유자 카드는 갈라서 중복을 없앴다).
  const meta = [
    movie ?? region,
    formatCardPeriod(startDate, endDate),
    `장소 ${spotCount}곳`,
  ].filter(Boolean).join(' · ');

  // 내 플랜이라 금액을 흐릴 이유가 없다 → 플랜파인더의 band 중앙값이 아니라 실제 총액을 만원 단위 반올림.
  // 원화 아닌 계획은 band 자체가 없으므로(summarize-plan-cost) 통화기호+정확값으로 표기.
  const priceLabel =
    total === 0
      ? '금액 없음'
      : currency === 'KRW'
        ? `총 약 ${Math.round(total / 10_000).toLocaleString()}만원`
        : `총 ${formatAmount(total, currency)}`;

  return (
    // 카드 전체가 상세 링크(absolute inset-0 <Link>)이고, ⋯ 메뉴·커버 추가는 그 위에 얹은 형제다.
    // 링크가 카드를 감싸면 그 안의 버튼이 중첩 인터랙티브가 되어 무효 — 형제로 두고 z로 올린다.
    <div
      className="group relative h-[240px] sm:h-[280px] rounded-[14px] overflow-hidden"
      style={{ backgroundColor: CARD_FALLBACK_BG }}
    >
      <Link href={`/my-plan/${id}`} className="absolute inset-0 flex flex-col">
        {coverUrl && (
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes={PLAN_CARD_SIZES}
            className="object-cover transition-transform duration-[400ms] group-hover:scale-[1.03]"
          />
        )}

        <div className="absolute inset-0" style={{ background: CARD_COVER_OVERLAY }} aria-hidden />

        {/* 상단 바 — 상태 칩 + 지역 칩. ⋯ 자리는 아래 형제가 차지하므로 오른쪽 여백만 비워둔다. */}
        <div className="relative flex items-start gap-1.5 pl-4 pr-[52px] pt-[13px] sm:pt-[14px]">
          <StateChip isPublic={isPublic} isDraft={isDraft} />
          {region && (
            <span className={`${CHIP_BASE} min-w-0 ${CARD_PILL_CLASS}`}>
              <span className="truncate min-w-0">{region}</span>
            </span>
          )}
        </div>

        {/* 하단 — 제목·메타·금액. 좋아요는 공개 플랜에만(남이 누른 수라 토글이 아닌 표시). */}
        <div className="relative mt-auto px-4 pb-4" style={{ textShadow: CARD_TEXT_SHADOW }}>
          <p className="text-[14px] font-semibold text-white truncate">{title}</p>
          <p className="mt-1 text-[12.5px] text-white/75 truncate">{meta}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium text-white whitespace-nowrap">
              {headcount}인 · {priceLabel}
            </span>
            {isPublic && (
              <span className="inline-flex items-center gap-1 shrink-0 text-[12.5px] font-medium text-white/90 whitespace-nowrap">
                <Heart size={13} />
                {likeCount}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* 커버 없음 — 플랜파인더의 죽은 "이미지 없음" 대신 편집 화면 진입점(내 화면의 결핍은 고칠 수 있다). */}
      {!coverUrl && (
        <Link
          href={`/my-plan/${id}/edit`}
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-[13px] py-2 text-[12.5px] font-medium text-white/90 hover:bg-white/20 transition-colors"
        >
          <ImagePlus size={14} />
          커버 추가
        </Link>
      )}

      <MyPlanCardMenu planId={id} title={title} isPublic={isPublic} />
    </div>
  );
}
