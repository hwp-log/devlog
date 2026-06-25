import Link from 'next/link';
import {
  Heart,
  Plane,
  Bus,
  Hotel,
  Utensils,
  Ticket,
  Package,
  MapPin,
  Calendar,
  User,
} from 'lucide-react';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import { getAvatarInfo } from '@/lib/avatar/generate';

type Props = PublicPlanListItem;

const CATEGORY_ICON = {
  FLIGHT: Plane,
  TRANSPORT: Bus,
  ACCOMMODATION: Hotel,
  FOOD: Utensils,
  ENTRANCE: Ticket,
  ETC: Package,
} as const;

const PILL_CLASS =
  'inline-flex items-center gap-1 text-xs px-[9px] py-0.5 rounded-full bg-slate-100 text-slate-600';

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

  const visible = summary.ratios
    .filter((r) => r.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio);
  const mobileTop = visible.slice(0, 3);
  const mobileRest = visible.length - mobileTop.length;
  const desktopTop = visible.slice(0, 4);
  const desktopRest = visible.length - desktopTop.length;

  return (
    <Link
      href={`/plan-finder/${id}`}
      className="group grid items-center gap-x-[15px] bg-white border border-slate-200 rounded-xl px-4 py-3 transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-slate-300 [grid-template-columns:auto_1.25fr_1.05fr_auto]"
    >
      {/* ① 아바타 */}
      <div
        className="relative w-16 h-16 shrink-0 overflow-hidden"
        style={{ borderRadius: '18px 18px 18px 4px', backgroundColor: color }}
        aria-label={`${authorNickname} 아바타`}
      >
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white select-none">
          {initial}
        </span>
      </div>

      {/* ② 제목 + 태그 pill */}
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-[#1A1A1A] truncate">{title}</p>
        <div className="flex items-center gap-1.5 mt-[5px] flex-wrap">
          {(region || movie) && (
            <span className={PILL_CLASS}>
              <MapPin size={11} className="text-slate-400" />
              {region ?? movie}
            </span>
          )}
          <span className={PILL_CLASS}>
            <Calendar size={11} className="text-slate-400" />
            {dateStr}
          </span>
          <span className={PILL_CLASS}>
            <User size={11} className="text-slate-400" />
            {authorNickname}
          </span>
        </div>
      </div>

      {/* ③ 카테고리 아이콘 */}
      <div className="min-w-0">
        <div className="flex sm:hidden items-center gap-2">
          {mobileTop.map((item) => {
            const Icon = CATEGORY_ICON[item.category];
            return (
              <span key={item.category} className="inline-flex items-center gap-0.5 text-sm text-slate-700">
                <Icon size={18} className="text-sky-500" />
                {Math.round(item.ratio)}%
              </span>
            );
          })}
          {mobileRest > 0 && (
            <span className="inline-flex items-center text-sm text-slate-400">+{mobileRest}</span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {desktopTop.map((item) => {
            const Icon = CATEGORY_ICON[item.category];
            return (
              <span key={item.category} className="inline-flex items-center gap-0.5 text-sm text-slate-700">
                <Icon size={18} className="text-sky-500" />
                {Math.round(item.ratio)}%
              </span>
            );
          })}
          {desktopRest > 0 && (
            <span className="inline-flex items-center text-sm text-slate-400">+{desktopRest}</span>
          )}
        </div>
      </div>

      {/* ④ 가격 + 좋아요 (한 줄) */}
      <div className="flex items-center gap-3">
        {summary.band ? (
          <p className="text-base font-medium text-[#1A1A1A] whitespace-nowrap">
            약 {(summary.band.lower / 10_000).toLocaleString()}만~{(summary.band.upper / 10_000).toLocaleString()}만원
          </p>
        ) : (
          <p className="text-base font-medium text-slate-400 whitespace-nowrap">금액 없음</p>
        )}
        <p className="text-[13px] text-slate-400 inline-flex items-center gap-0.5">
          <Heart size={12} className={isLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
          {likeCount}
        </p>
      </div>
    </Link>
  );
}
