import { Heart } from 'lucide-react';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import {
  CATEGORY_COLOR,
  FLIGHT_COLOR,
  type CostCategory,
} from '@/app/(protected)/my-plan/_lib/cost';

export function PlanCard({
  id,
  title,
  region,
  movie,
  createdAt,
  likeCount,
  summary,
}: PublicPlanListItem) {
  const dateStr = `${createdAt.getFullYear()}.${createdAt.getMonth() + 1}.${createdAt.getDate()}`;

  return (
    <div className="glass-outer glass-outer-interactive overflow-hidden block cursor-pointer">
      <div className="p-5">
        {/* 누적 막대 */}
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-3">
          {summary.ratios.map((item) => {
            const color = item.category === 'FLIGHT'
              ? FLIGHT_COLOR
              : CATEGORY_COLOR[item.category as CostCategory];
            return (
              <div
                key={item.category}
                style={{ width: `${item.ratio}%`, backgroundColor: color }}
              />
            );
          })}
        </div>

        {/* 총액 구간 */}
        {summary.band && (
          <p className="text-sm font-semibold text-[#1A1A1A] mb-2">
            약 {(summary.band.lower / 10_000).toLocaleString()}만 ~ {(summary.band.upper / 10_000).toLocaleString()}만 원
          </p>
        )}

        {/* 범례 */}
        {summary.ratios.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
            {summary.ratios.slice(0, 3).map((item) => {
              const color = item.category === 'FLIGHT'
                ? FLIGHT_COLOR
                : CATEGORY_COLOR[item.category as CostCategory];
              return (
                <span key={item.category} className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {item.label}
                </span>
              );
            })}
            {summary.ratios.length > 3 && (
              <span className="text-xs text-slate-400">+{summary.ratios.length - 3}</span>
            )}
          </div>
        )}

        {/* 제목 */}
        <h2 className="text-base font-semibold text-[#1A1A1A] leading-snug mb-2">{title}</h2>

        {/* movie · region 태그 */}
        {(movie || region) && (
          <div className="flex flex-wrap gap-1.5">
            {movie && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {movie}
              </span>
            )}
            {region && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {region}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 하단 바 */}
      <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">{dateStr}</span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Heart size={13} />
          <span>{likeCount}</span>
        </span>
      </div>
    </div>
  );
}
