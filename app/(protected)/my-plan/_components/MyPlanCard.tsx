import Link from 'next/link';
import {
  MapPin,
  Calendar,
  Plane,
  Bus,
  Hotel,
  Utensils,
  Ticket,
  Package,
} from 'lucide-react';
import {
  formatAmount,
  type CostCategory,
} from '../_lib/cost';

type Currency = 'KRW' | 'USD' | 'JPY';

export type Ratio = {
  category: 'FLIGHT' | CostCategory;
  label: string;
  ratio: number;
};

interface MyPlanCardProps {
  id: string;
  title: string;
  region: string | null;
  currency: Currency;
  startDate: Date | null;
  endDate: Date | null;
  total: number;
  ratios: Ratio[];
}

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

export function MyPlanCard({
  id,
  title,
  region,
  currency,
  startDate,
  endDate,
  total,
  ratios,
}: MyPlanCardProps) {
  const visible = ratios.filter((r) => r.ratio > 0);
  const mobileTop = visible.slice(0, 3);
  const mobileRest = visible.length - mobileTop.length;
  const desktopTop = visible.slice(0, 4);
  const desktopRest = visible.length - desktopTop.length;

  const periodStr = startDate && endDate
    ? `${startDate.toLocaleDateString('ko-KR')} ~ ${endDate.toLocaleDateString('ko-KR')}`
    : null;

  const isEmpty = total === 0;

  return (
    <Link
      href={`/my-plan/${id}`}
      className="group grid items-center gap-x-4 min-h-[88px] bg-white border border-slate-200 rounded-xl px-4 py-3 transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-slate-300 [grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)_90px_auto] sm:[grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)_110px_auto]"
    >
      {/* ① 제목 + pill 그룹 */}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-[#1A1A1A] truncate">{title}</p>
        <div className="flex items-center gap-1.5 mt-[5px] flex-wrap">
          {region && (
            <span className={PILL_CLASS}>
              <MapPin size={11} className="text-slate-400" />
              {region}
            </span>
          )}
          {periodStr && (
            <span className={PILL_CLASS}>
              <Calendar size={11} className="text-slate-400" />
              {periodStr}
            </span>
          )}
        </div>
      </div>

      {/* ② 카테고리 아이콘 + % */}
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

      {/* ③ 정확 총액 */}
      <div className="shrink-0">
        {isEmpty ? (
          <p className="text-sm text-slate-400 whitespace-nowrap">예산 미입력</p>
        ) : (
          <p className="text-base font-medium text-[#1A1A1A] whitespace-nowrap">
            {formatAmount(total, currency)}
          </p>
        )}
      </div>

      {/* ④ chevron */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-slate-400"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
