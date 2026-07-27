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
  'inline-flex items-center gap-1 text-xs px-[9px] py-0.5 rounded-full bg-surface2 text-fg2';

export function PlanCard({
  id,
  title,
  region,
  movie,
  createdAt,
  likeCount,
  isLiked,
  authorNickname,
  authorAvatarUrl,
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
      className="group grid items-center gap-x-[15px] bg-card border border-border rounded-xl px-4 py-3 transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-border [grid-template-columns:auto_1.25fr_1.05fr_auto]"
    >
      {/* ① 아바타 */}
      <div
        className="relative w-16 h-16 shrink-0 overflow-hidden"
        style={{
          borderRadius: '18px 18px 18px 4px',
          backgroundColor: authorAvatarUrl ? undefined : color,
        }}
        aria-label={`${authorNickname} 아바타`}
      >
        {authorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={authorAvatarUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white select-none">
            {initial}
          </span>
        )}
      </div>

      {/* ② 제목 + 태그 pill */}
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-fg truncate">{title}</p>
        <div className="flex items-center gap-1.5 mt-[5px] flex-wrap">
          {(region || movie) && (
            <span className={PILL_CLASS}>
              <MapPin size={11} className="text-muted" />
              {region ?? movie}
            </span>
          )}
          <span className={PILL_CLASS}>
            <Calendar size={11} className="text-muted" />
            {dateStr}
          </span>
          <span className={PILL_CLASS}>
            <User size={11} className="text-muted" />
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
              <span key={item.category} className="inline-flex items-center gap-0.5 text-sm text-fg2">
                <Icon size={18} className="text-primary" />
                {Math.round(item.ratio)}%
              </span>
            );
          })}
          {mobileRest > 0 && (
            <span className="inline-flex items-center text-sm text-muted">+{mobileRest}</span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {desktopTop.map((item) => {
            const Icon = CATEGORY_ICON[item.category];
            return (
              <span key={item.category} className="inline-flex items-center gap-0.5 text-sm text-fg2">
                <Icon size={18} className="text-primary" />
                {Math.round(item.ratio)}%
              </span>
            );
          })}
          {desktopRest > 0 && (
            <span className="inline-flex items-center text-sm text-muted">+{desktopRest}</span>
          )}
        </div>
      </div>

      {/* ④ 가격 + 좋아요 (한 줄) */}
      <div className="flex items-center gap-3">
        {summary.band ? (
          <p className="text-base font-medium text-fg whitespace-nowrap">
            약 {(summary.band.lower / 10_000).toLocaleString()}만~{(summary.band.upper / 10_000).toLocaleString()}만원
          </p>
        ) : (
          <p className="text-base font-medium text-muted whitespace-nowrap">금액 없음</p>
        )}
        <p className="text-[13px] text-muted inline-flex items-center gap-0.5">
          <Heart size={12} className={isLiked ? 'fill-heart-active text-heart-active' : 'text-muted'} />
          {likeCount}
        </p>
      </div>
    </Link>
  );
}
