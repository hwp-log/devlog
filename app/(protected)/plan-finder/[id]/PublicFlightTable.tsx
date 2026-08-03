import { AIRPORT_NAME, PLANE_ICON, type FlightLegData, type FlightSegmentData } from '@/app/(protected)/my-plan/_components/FlightLeg';

// 0492: 공개 상세 항공표. 편별 금액 열 없음 — 스키마에 편별 가격이 없고(왕복 totalAmount 하나),
// 한 행에만 금액을 두면 오는편이 무료로 오독된다. 총액은 섹션 제목이 한 번만 표기(같은 열=같은 종류의 값).
// 소유자 뷰의 FlightLeg(2카드·날짜/시간/금액)와 분리 — 이 표는 플랜파인더 전용.

function LegRow({ seg, label }: { seg: FlightSegmentData; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-border last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-xs font-semibold text-muted shrink-0 sm:w-12">{label}</span>

      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        <span className="text-[15px] font-bold text-fg leading-none">{seg.origin}</span>
        <span className="text-xs text-muted">{AIRPORT_NAME[seg.origin] ?? ''}</span>
        <span className="text-muted" aria-hidden>{PLANE_ICON}</span>
        <span className="text-[15px] font-bold text-fg leading-none">{seg.destination}</span>
        <span className="text-xs text-muted">{AIRPORT_NAME[seg.destination] ?? ''}</span>
      </div>

      <span className="text-xs text-muted shrink-0">{seg.durationLabel ?? ''} · 직항</span>
      <span className="text-xs text-fg2 shrink-0 sm:w-28 sm:text-right">
        {seg.airline} {seg.flightNo}
      </span>
    </div>
  );
}

export function PublicFlightTable({ data }: { data: FlightLegData }) {
  const isRoundTrip = data.tripType === 'ROUND_TRIP';
  return (
    <div className="bg-card border border-border rounded-[14px] px-4">
      <LegRow seg={data.out} label="가는편" />
      {isRoundTrip && data.ret && <LegRow seg={data.ret} label="오는편" />}
    </div>
  );
}
