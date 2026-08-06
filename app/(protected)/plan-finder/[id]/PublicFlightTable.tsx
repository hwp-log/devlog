import { AIRPORT_NAME, type FlightLegData, type FlightSegmentData } from '@/app/(protected)/my-plan/_components/FlightLeg';

// 0492: 공개 상세 항공표. 편별 금액 열 없음 — 스키마에 편별 가격이 없고(왕복 totalAmount 하나),
// 한 행에만 금액을 두면 오는편이 무료로 오독된다. 총액은 섹션 제목이 한 번만 표기(같은 열=같은 종류의 값).
// 소유자 뷰의 FlightLeg(2카드·날짜/시간/금액)와 분리 — 이 표는 플랜파인더 전용.
// 0514: 카드 제거, 4열 행([라벨 60px][노선][소요][편명])으로 정리(시안 4a). 모바일은 세로 유지.

// 0515: 모바일은 라벨을 위로 올린 2줄 카드(시안 4d) — 라벨 / 노선 / 소요·직항·편명 한 줄.
// 0522: 공통 척도 — 노선은 본문 16px, 나머지(라벨·공항명·소요·편명)는 보조 14px.
function LegRow({ seg, label }: { seg: FlightSegmentData; label: string }) {
  return (
    <div className="flex flex-col gap-[3px] sm:grid sm:grid-cols-[60px_1fr_max-content_max-content] sm:items-center sm:gap-5 sm:py-[15px] sm:border-b sm:border-[#f1f2f3]">
      <span className="text-[11px] sm:text-sm font-semibold text-muted shrink-0">{label}</span>

      <div className="flex items-center gap-2 flex-wrap min-w-0 text-base font-semibold text-fg">
        <span>{seg.origin}</span>
        <span className="sm:text-sm sm:font-normal sm:text-muted">{AIRPORT_NAME[seg.origin] ?? ''}</span>
        <span aria-hidden>→</span>
        <span>{seg.destination}</span>
        <span className="sm:text-sm sm:font-normal sm:text-muted">{AIRPORT_NAME[seg.destination] ?? ''}</span>
      </div>

      <span className="text-xs sm:text-sm text-muted shrink-0">
        {seg.durationLabel ?? ''} · 직항
        <span className="sm:hidden">
          {' '}· {seg.airline} {seg.flightNo}
        </span>
      </span>
      <span className="max-sm:hidden text-sm font-semibold text-fg2 shrink-0">
        {seg.airline} {seg.flightNo}
      </span>
    </div>
  );
}

export function PublicFlightTable({ data }: { data: FlightLegData }) {
  const isRoundTrip = data.tripType === 'ROUND_TRIP';
  return (
    <div className="flex flex-col gap-3.5 sm:block">
      <LegRow seg={data.out} label="가는편" />
      {isRoundTrip && data.ret && <LegRow seg={data.ret} label="오는편" />}
    </div>
  );
}
