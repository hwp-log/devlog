import Link from 'next/link';
import Image from 'next/image';
import { Heart, Lock, Globe, ImagePlus } from 'lucide-react';
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

// 상태 칩 — 색은 "공개"에만. 채움(공개) > 기본 재질(비공개) 2단(CLAUDE.md §9).
// 0558: 초안(isDraft) 칩 폐기 — "미완성=숨김"은 isPublic=false가 담는다(0557 재정의). 컬럼 drop은 별도 사이클.
// 공개 칩만 primary 면. 글자는 사용자 지시로 흰색 — 0529의 주요 버튼과 같은 선택
// (primary-fg #0b1a2b가 6.39:1로 더 높지만 흰 글씨의 인상을 택함, 2.74:1은 알고 수용).
const CHIP_BASE =
  'inline-flex items-center gap-1 shrink-0 text-[11px] leading-none px-[9px] py-[4px] rounded-full';
const PUBLIC_CHIP = 'bg-primary text-white font-semibold';

function StateChip({ isPublic }: { isPublic: boolean }) {
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
  likeCount,
}: MyPlanCardProps) {
  // 메타 한 줄 — 지역은 칩으로 올라갔으므로 여기선 작품이 앞. 작품이 없을 때만 지역으로 대체
  // (플랜파인더는 지역을 칩·메타에 두 번 쓰지만, 소유자 카드는 갈라서 중복을 없앴다).
  const meta = [
    movie ?? region,
    formatCardPeriod(startDate, endDate),
    `장소 ${spotCount}곳`,
  ].filter(Boolean).join(' · ');

  // 0558: 만원 반올림 근사 폐기 — 전 화면 실값 통일(PlanCard와 동일 표기)
  const priceLabel = total === 0 ? '금액 없음' : `총 ${formatAmount(total, currency)}`;

  return (
    // 카드 전체가 상세 링크(absolute inset-0 <Link>)이고, ⋯ 메뉴·커버 추가는 그 위에 얹은 형제다.
    // 링크가 카드를 감싸면 그 안의 버튼이 중첩 인터랙티브가 되어 무효 — 형제로 두고 z로 올린다.
    <div
      className="group relative h-[240px] sm:h-[280px] rounded-[14px] overflow-hidden"
      style={{ backgroundColor: CARD_FALLBACK_BG }}
    >
      {/* 0560: 상세 한 벌화 — /my-plan/[id] 폐기, 공개 상세가 정본(소유자는 관리 버튼 포함 렌더) */}
      <Link href={`/plan-finder/${id}`} className="absolute inset-0 flex flex-col">
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
          <StateChip isPublic={isPublic} />
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
