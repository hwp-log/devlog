import Link from 'next/link';
import { formatAmount } from '@/app/(protected)/my-plan/_lib/cost';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import {
  CARD_PILL_CLASS,
  CARD_COVER_OVERLAY,
  CARD_TEXT_SHADOW,
  CARD_FALLBACK_BG,
  CARD_FALLBACK_FG,
  PLAN_CARD_SIZES,
} from '@/lib/card-tokens';

type Props = PublicPlanListItem;

// 0530: sizes·스크림·폴백·그늘 상수는 card-tokens.ts로 이관(MyPlanCard와 공유).
// 프리로더(PlanListClient)도 card-tokens에서 직접 import한다.

export function PlanCard({
  id,
  title,
  region,
  movie,
  coverUrl,
  headcount,
  spotCount,
  dayCount,
  likeCount,
  isLiked,
  summary,
}: Props) {
  const regionLabel = region ?? movie;
  // 메타 한 줄 — 결측 세그먼트는 스킵. 인원수(N인)는 금액 줄로 이동(0441) — 총액 규모를 인원 옆에서 납득시키기 위함.
  const meta = [
    regionLabel,
    dayCount ? `${dayCount}일` : null,
    `장소 ${spotCount}곳`,
  ].filter(Boolean).join(' · ');

  // "총" = 총액 신호. 인원과 나란히 둘 때 1인당으로 오해되지 않도록("N인 기준"은 여행상품 1인당 관행이라 회피).
  // 0558: band 중앙값 근사 폐기 — 실값(formatAmount). 0532 금액줄 227px 실측 대비 +~20px,
  // 카드 하한 320 여유(1.41배) 안. 총액 0이면 기존 '금액 없음' 유지.
  const priceLabel = summary.total > 0
    ? `총 ${formatAmount(summary.total, summary.currency)}`
    : '금액 없음';

  return (
    <Link
      href={`/plan-finder/${id}`}
      className="group relative flex flex-col h-[240px] sm:h-[280px] rounded-[14px] overflow-hidden"
    >
      {/* 배경 레이어 — 커버 or 무채 폴백 */}
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes={PLAN_CARD_SIZES}
          className="object-cover transition-transform duration-[400ms] group-hover:scale-[1.03]"
        />
      ) : (
        // 커버 없음 폴백 — "이미지 없음" 중앙. 배경·글씨는 테마 무관 고정 다크(FALLBACK_*)라
        // 라이트/다크 모두 다크 카드로 통일(흰 글씨·스크림 카드와 정합). 텍스트는 오버레이 알파 0 구간이라 간섭 없음.
        <div
          className="absolute inset-0 flex items-center justify-center text-xs"
          style={{ backgroundColor: CARD_FALLBACK_BG, color: CARD_FALLBACK_FG }}
        >
          이미지 없음
        </div>
      )}

      {/* 오버레이 */}
      <div className="absolute inset-0" style={{ background: CARD_COVER_OVERLAY }} aria-hidden />

      {/* 콘텐츠 — 상단 바 */}
      <div className="relative flex items-start justify-between px-4 pt-[13px] sm:pt-[14px]">
        {regionLabel && (
          <span
            className={`inline-flex items-center text-[11px] leading-none px-[9px] py-[3px] rounded-full ${CARD_PILL_CLASS}`}
          >
            {regionLabel}
          </span>
        )}
        <span
          className={`ml-auto inline-flex items-center gap-1 text-[12.5px] px-[9px] py-[3px] rounded-full leading-none ${CARD_PILL_CLASS}`}
        >
          {/* 비활성 하트는 칩 글씨색(currentColor) 상속 — 라이트=어두움/다크=흰색. 눌렀을 때만 빨강(양쪽 카드 동일). */}
          <Heart size={13} className={isLiked ? 'fill-heart-active text-heart-active' : undefined} />
          {likeCount}
        </span>
      </div>

      {/* 콘텐츠 — 하단 */}
      <div className="relative mt-auto px-4 pb-4" style={{ textShadow: CARD_TEXT_SHADOW }}>
        <p className="text-[14px] font-semibold text-white truncate">{title}</p>
        <p className="mt-1 text-[12.5px] text-white/75 truncate">{meta}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          {/* 인원수를 금액 앞에 — 비싼 총액도 인원 옆이면 납득된다(0441). 인원·금액 같은 흰색으로 한 덩어리.
              금액 없음 카드도 "N인 · 금액 없음"으로 인원 유지. */}
          <span className="text-[14px] font-medium text-white whitespace-nowrap tabular-nums">
            {headcount}인 · {priceLabel}
          </span>
          {/* 0435: 강조색(#4d9eff)은 12.5px 작은 글씨라 스크림 위 4.5:1 미달(≈2.1:1) → 흰색.
              카드 전체가 링크이므로 별개 버튼이 아닌 방향 라벨이고, →가 클릭 신호를 담당.
              (0441에서 파랑·볼드를 시도했으나 스크림 위 가독이 흰색만 못해 환원.) */}
          <span className="text-[12.5px] font-medium text-white whitespace-nowrap shrink-0">코스 보기 →</span>
        </div>
      </div>
    </Link>
  );
}
