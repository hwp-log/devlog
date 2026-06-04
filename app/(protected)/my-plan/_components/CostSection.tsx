import type React from 'react';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  FLIGHT_COLOR,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';

const FLIGHT_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
  </svg>
);

export const CATEGORY_ICON: Record<CostCategory, React.ReactNode> = {
  TRANSPORT: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  ),
  ACCOMMODATION: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/>
    </svg>
  ),
  FOOD: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-4-15.03-4-15.03 0h15.03zM1.02 17h15v2h-15z"/>
    </svg>
  ),
  ENTRANCE: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-1.99 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-2-1.46c-1.19.69-2 1.99-2 3.46s.81 2.77 2 3.46V18H4v-2.54c1.19-.69 2-1.99 2-3.46 0-1.48-.8-2.77-2-3.46V6h16v2.54z"/>
    </svg>
  ),
  ETC: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 3.02 15.96 1 13.45 1h-2.9C8.04 1 6 3.02 6 4.64c0 .48.11.92.18 1.36H4C2.9 6 2 6.9 2 8v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6.55-3c.83 0 1.55.45 1.55 1.64H9c0-1.19.72-1.64 1.55-1.64h2.9z"/>
    </svg>
  ),
};

interface Props {
  totals: Record<CostCategory, number>;
  flightAmount: number;
  currency: 'KRW' | 'USD' | 'JPY';
}

export function CostSection({ totals, flightAmount, currency }: Props) {
  const total = CATEGORIES.reduce((sum, cat) => sum + totals[cat], 0) + flightAmount;
  const max = Math.max(0, flightAmount, ...CATEGORIES.map((cat) => totals[cat]));

  return (
    <>
      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
        카테고리별 비용
      </p>
      <div className="glass-outer p-5 mb-4">
        <div>
          {flightAmount > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <span style={{ color: FLIGHT_COLOR, fontSize: 13, lineHeight: 1, display: 'flex' }}>
                    {FLIGHT_ICON}
                  </span>
                  <span style={{ fontSize: 13, color: '#4A4A4A' }}>항공</span>
                </div>
                <span style={{ fontSize: 12, color: '#888' }}>
                  ₩{flightAmount.toLocaleString()}
                </span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(0,0,0,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${max > 0 ? (flightAmount / max) * 100 : 0}%`, backgroundColor: FLIGHT_COLOR }}
                />
              </div>
            </div>
          )}
          {CATEGORIES.map((cat, idx) => {
            const barPct = max > 0 ? (totals[cat] / max) * 100 : 0;
            return (
              <div key={cat} style={{ marginBottom: idx < CATEGORIES.length - 1 ? 14 : 0 }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ color: CATEGORY_COLOR[cat], fontSize: 13, lineHeight: 1, display: 'flex' }}>
                      {CATEGORY_ICON[cat]}
                    </span>
                    <span style={{ fontSize: 13, color: '#4A4A4A' }}>{CATEGORY_LABEL[cat]}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {formatAmount(totals[cat], currency)}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(0,0,0,0.05)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${barPct}%`, backgroundColor: CATEGORY_COLOR[cat] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="flex justify-between"
          style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}
        >
          <span style={{ fontSize: 13, color: '#666' }}>총 비용</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {formatAmount(total, currency)}
          </span>
        </div>
      </div>
    </>
  );
}
