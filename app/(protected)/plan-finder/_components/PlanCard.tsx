import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import { CARD_PILL_BG } from '@/lib/card-tokens';

type Props = PublicPlanListItem;

// 커버 이미지 sizes — 인접 페이지 프리로더(PlanListClient)가 같은 srcSet을 얻으려면
// getImageProps에 이 값을 그대로 넣어야 한다. 단일 소스: 아래 <Image>와 프리로더가 공유(한쪽만 바꾸면 캐시 어긋남).
export const PLAN_CARD_SIZES = '(max-width: 767px) 100vw, 400px';

// 커버 위 스크림 — 하단 텍스트 대비 확보. 커버 null(무채 폴백) 시에도 동일 적용.
// 반투명 검정은 theme 토큰 예외 허용(0406).
// 0435: 그라디언트가 텍스트 블록 안에서 옅어져 밝은 사진에서 4.5:1을 못 만들던 문제 해결.
// 하단 텍스트 블록(측정 ≈89px = 240px 카드의 37% / 280px의 32%)을 alpha 0.65 스크림으로 덮는다.
// 어둠 총높이를 좁혀 사진을 더 보이게: 0%~32% 균일 → 44%에서 0(전환 12%≈30px).
// 균일 0.65 → 순백 배경에서도 흰 글씨 ≈7:1, 반투명 메타(75%) ≈4.8:1 (WCAG 4.5:1 충족).
// 주의: 균일 끝(32%)이 블록 상단(≈37%)보다 살짝 아래라 제목 상단 획은 전환 구간에 걸쳐
// 순백 배경 최악점에서 fill 대비 ≈3.3:1까지 내려감 — TEXT_SHADOW(보조)로 국소 대비 보강.
// 전환 경계가 선처럼 보이면 44% → 48%로 넓힐 것.
const OVERLAY =
  'linear-gradient(to top, rgba(10,10,16,0.65) 0%, rgba(10,10,16,0.65) 32%, rgba(10,10,16,0) 44%)';

// 0435: 하단 텍스트 그늘 — 밝은 커버에서도 흰/파랑 글씨 가독. 컨테이너에 한 번(상속으로 4요소 공유).
// 오프셋 1px·번짐 3px로 작게 — 과하면 글씨가 뭉갬. 반투명 검정 예외 허용(0406).
const TEXT_SHADOW = '0 1px 3px rgba(0,0,0,0.7)';

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
            style={{ backgroundColor: CARD_PILL_BG }}
          >
            {regionLabel}
          </span>
        )}
        <span
          className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-white/90 px-[9px] py-[3px] rounded-full leading-none"
          style={{ backgroundColor: CARD_PILL_BG }}
        >
          <Heart size={13} className={isLiked ? 'fill-heart-active text-heart-active' : 'text-white/90'} />
          {likeCount}
        </span>
      </div>

      {/* 콘텐츠 — 하단 */}
      <div className="relative mt-auto px-4 pb-4" style={{ textShadow: TEXT_SHADOW }}>
        <p className="text-[14px] font-semibold text-white truncate">{title}</p>
        <p className="mt-1 text-[12.5px] text-white/75 truncate">{meta}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[14px] font-medium text-white whitespace-nowrap">{priceLabel}</span>
          {/* 0435: 강조색(#4d9eff)은 12.5px 작은 글씨라 스크림 위 4.5:1 미달(≈2.1:1) → 흰색.
              카드 전체가 링크이므로 별개 버튼이 아닌 방향 라벨이고, →가 클릭 신호를 담당. */}
          <span className="text-[12.5px] font-medium text-white whitespace-nowrap">코스 보기 →</span>
        </div>
      </div>
    </Link>
  );
}
