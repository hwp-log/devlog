import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import type { PublicPlanListItem } from '@/lib/plan/queries';

type Props = PublicPlanListItem;

// 커버 이미지 sizes — 인접 페이지 프리로더(PlanListClient)가 같은 srcSet을 얻으려면
// getImageProps에 이 값을 그대로 넣어야 한다. 단일 소스: 아래 <Image>와 프리로더가 공유(한쪽만 바꾸면 캐시 어긋남).
export const PLAN_CARD_SIZES = '(max-width: 767px) 100vw, 400px';

// 커버 위 어두운 그라디언트 — 하단 흰 텍스트 대비 확보. 커버 null(무채 폴백) 시에도 동일 적용.
// 반투명 검정은 theme 토큰 예외 허용(0406). 하단이 가장 어둡고 위로 갈수록 옅어짐.
const OVERLAY =
  'linear-gradient(to top, rgba(10,10,16,0.92) 0%, rgba(10,10,16,0.6) 42%, rgba(10,10,16,0.12) 72%, rgba(10,10,16,0.28) 100%)';

// 지역 pill 반투명 검정(예외 허용)
const PILL_BG = 'rgba(13,13,20,0.72)';

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
  // 메타 한 줄 — 결측 세그먼트는 스킵
  const meta = [
    regionLabel,
    dayCount ? `${dayCount}일` : null,
    `스팟 ${spotCount}곳`,
    `${headcount}인`,
  ].filter(Boolean).join(' · ');

  const priceLabel = summary.band
    ? `약 ${Math.round((summary.band.lower + summary.band.upper) / 2 / 10_000).toLocaleString()}만원`
    : '금액 없음';

  return (
    <Link
      href={`/plan-finder/${id}`}
      className="group relative flex flex-col h-[240px] sm:h-[280px] rounded-[14px] border border-border overflow-hidden"
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
        <div className="absolute inset-0 bg-fill2" aria-hidden />
      )}

      {/* 오버레이 */}
      <div className="absolute inset-0" style={{ background: OVERLAY }} aria-hidden />

      {/* 콘텐츠 — 상단 바 */}
      <div className="relative flex items-start justify-between px-4 pt-[13px] sm:pt-[14px]">
        {regionLabel && (
          <span
            className="inline-flex items-center text-[11px] leading-none text-white/95 px-[9px] py-[3px] rounded-full"
            style={{ backgroundColor: PILL_BG }}
          >
            {regionLabel}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-white/90">
          <Heart size={13} className={isLiked ? 'fill-heart-active text-heart-active' : 'text-white/90'} />
          {likeCount}
        </span>
      </div>

      {/* 콘텐츠 — 하단 */}
      <div className="relative mt-auto px-4 pb-4">
        <p className="text-[14px] font-semibold text-white truncate">{title}</p>
        <p className="mt-1 text-[12.5px] text-white/75 truncate">{meta}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[14px] font-medium text-white whitespace-nowrap">{priceLabel}</span>
          <span className="text-[12.5px] font-medium text-primary whitespace-nowrap">코스 보기 →</span>
        </div>
      </div>
    </Link>
  );
}
