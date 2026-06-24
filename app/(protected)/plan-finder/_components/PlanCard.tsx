import Link from 'next/link';
import { Heart, ChevronRight } from 'lucide-react';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import {
  CATEGORY_COLOR,
  FLIGHT_COLOR,
  type CostCategory,
} from '@/app/(protected)/my-plan/_lib/cost';
import { getAvatarInfo } from '@/lib/avatar/generate';

type Props = PublicPlanListItem;

export function PlanCard({
  id,
  title,
  region,
  movie,
  createdAt,
  likeCount,
  isLiked,
  authorNickname,
  summary,
}: Props) {
  const dateStr = `${createdAt.getFullYear()}.${createdAt.getMonth() + 1}.${createdAt.getDate()}`;
  const { initial, color } = getAvatarInfo(authorNickname);

  return (
    <Link
      href={`/plan-finder/${id}`}
      className="group flex items-center gap-3.5 bg-white border border-slate-200 rounded-xl px-4 py-3 transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-slate-300"
    >
      {/* 좌측: 작성자 아바타 말풍선 + 순위 뱃지 */}
      <div
        className="relative w-16 h-16 shrink-0 overflow-hidden"
        style={{ borderRadius: '18px 18px 18px 4px', backgroundColor: color }}
        aria-label={`${authorNickname} 아바타`}
      >
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white select-none">
          {initial}
        </span>
      </div>

      {/* 중앙: 제목 / 지역칩+메타 / 미니 막대 */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-[#1A1A1A] truncate">{title}</p>
        <div className="flex items-center gap-2 mt-[5px] flex-wrap">
          {(region || movie) && (
            <span className="text-xs px-[9px] py-0.5 rounded-full bg-slate-100 text-slate-600">
              {region ?? movie}
            </span>
          )}
          <span className="text-xs text-slate-400">by {authorNickname} · {dateStr}</span>
        </div>
        <div className="flex h-[5px] max-w-[170px] rounded-full overflow-hidden mt-[9px] bg-slate-100">
          {summary.ratios.map((item) => {
            const color = item.category === 'FLIGHT'
              ? FLIGHT_COLOR
              : CATEGORY_COLOR[item.category as CostCategory];
            return <div key={item.category} style={{ flex: item.ratio, backgroundColor: color }} />;
          })}
        </div>
      </div>

      {/* 오른쪽: 금액 구간 + 하트 수 */}
      <div className="shrink-0 text-right">
        {summary.band ? (
          <p className="text-base font-medium text-[#1A1A1A] whitespace-nowrap">
            약 {(summary.band.lower / 10_000).toLocaleString()}만~{(summary.band.upper / 10_000).toLocaleString()}만원
          </p>
        ) : (
          <p className="text-base font-medium text-slate-400 whitespace-nowrap">금액 없음</p>
        )}
        <p className="text-[13px] text-slate-400 mt-1 flex items-center justify-end gap-0.5">
          <Heart size={12} className={isLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
          {likeCount}
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight
        size={18}
        className="text-slate-400 shrink-0 opacity-50 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5"
      />
    </Link>
  );
}
