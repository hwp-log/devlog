import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import {
  CATEGORY_COLOR,
  FLIGHT_COLOR,
  type CostCategory,
} from '@/app/(protected)/my-plan/_lib/cost';
import {
  CATEGORY_ICON,
  FLIGHT_ICON,
} from '@/app/(protected)/my-plan/_components/CostSection';

interface Props {
  summary: PublicCostSummary;
}

export function PublicCostSection({ summary }: Props) {
  const { ratios, band } = summary;

  return (
    <>
      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
        카테고리별 비중
      </p>
      <div className="glass-outer p-5 mb-4">
        <div>
          {ratios.map((item, idx) => {
            const color = item.category === 'FLIGHT'
              ? FLIGHT_COLOR
              : CATEGORY_COLOR[item.category as CostCategory];
            const icon = item.category === 'FLIGHT'
              ? FLIGHT_ICON
              : CATEGORY_ICON[item.category as CostCategory];

            return (
              <div key={item.category} style={{ marginBottom: idx < ratios.length - 1 ? 14 : 0 }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ color, fontSize: 13, lineHeight: 1, display: 'flex' }}>
                      {icon}
                    </span>
                    <span style={{ fontSize: 13, color: '#4A4A4A' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#888' }}>{item.ratio}%</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(0,0,0,0.05)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.ratio}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {band !== null && (
          <div
            className="flex justify-between"
            style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}
          >
            <span style={{ fontSize: 13, color: '#666' }}>총액 구간</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
              약 {(band.lower / 10_000).toLocaleString()}만 ~ {(band.upper / 10_000).toLocaleString()}만 원
            </span>
          </div>
        )}
      </div>
    </>
  );
}
