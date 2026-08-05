import { AIRPORT_NAME, type FlightLegData, type FlightSegmentData } from '@/app/(protected)/my-plan/_components/FlightLeg';

// 0492: 공개 상세 항공표. 편별 금액 열 없음 — 스키마에 편별 가격이 없고(왕복 totalAmount 하나),
// 한 행에만 금액을 두면 오는편이 무료로 오독된다. 총액은 섹션 제목이 한 번만 표기(같은 열=같은 종류의 값).
// 소유자 뷰의 FlightLeg(2카드·날짜/시간/금액)와 분리 — 이 표는 플랜파인더 전용.
// 0514: 카드 제거, 4열 행([라벨 60px][노선][소요][편명])으로 정리(시안 4a). 모바일은 세로 유지.

function LegRow({ seg, label }: { seg: FlightSegmentData; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-[#f1f2f3] sm:grid sm:grid-cols-[60px_1fr_max-content_max-content] sm:items-center sm:gap-5 sm:py-[15px]">
      <span className="text-[13px] font-semibold text-muted shrink-0">{label}</span>

      <div className="flex items-center gap-2 flex-wrap min-w-0 text-base font-semibold text-fg">
        <span>{seg.origin}</span>
        <span className="text-[13px] font-normal text-muted">{AIRPORT_NAME[seg.origin] ?? ''}</span>
        <span aria-hidden>→</span>
        <span>{seg.destination}</span>
        <span className="text-[13px] font-normal text-muted">{AIRPORT_NAME[seg.destination] ?? ''}</span>
      </div>

      <span className="text-[13px] text-muted shrink-0">{seg.durationLabel ?? ''} · 직항</span>
      <span className="text-[13px] font-semibold text-fg2 shrink-0">
        {seg.airline} {seg.flightNo}
      </span>
    </div>
  );
}

export function PublicFlightTable({ data }: { data: FlightLegData }) {
  const isRoundTrip = data.tripType === 'ROUND_TRIP';
  return (
    <div>
      <LegRow seg={data.out} label="가는편" />
      {isRoundTrip && data.ret && <LegRow seg={data.ret} label="오는편" />}
    </div>
  );
}
