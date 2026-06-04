export type FlightSegmentData = {
  origin: string;
  destination: string;
  departsAt: string;
  arrivesAt: string;
  airline: string;
  flightNo: string;
};

export type FlightLegData = {
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  totalAmount: number;
  out: FlightSegmentData;
  ret?: FlightSegmentData;
};

export const AIRPORT_NAME: Record<string, string> = {
  ICN: '인천 국제', GMP: '서울 김포', PUS: '부산 김해', CJU: '제주',
  NRT: '도쿄 나리타', HND: '도쿄 하네다', KIX: '오사카 간사이',
  FUK: '후쿠오카', OKA: '오키나와 나하', NGO: '나고야 중부',
  BKK: '방콕 수완나품', HKT: '푸켓', SIN: '싱가포르 창이',
  HKG: '홍콩', TPE: '타이베이 타오위안', PEK: '베이징 수도',
  PVG: '상하이 푸동', JFK: 'New York JFK', LAX: 'LA 국제',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDateFlight(iso: string) {
  const d = new Date(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}.${d.getDate()} (${wd})`;
}

function durationMin(from: string, to: string) {
  const m = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

export const PLANE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
  </svg>
);

function LegCard({ seg, label, isRoundTrip, totalAmount, showPrice }: {
  seg: FlightSegmentData;
  label: string;
  isRoundTrip: boolean;
  totalAmount: number;
  showPrice: boolean;
}) {
  const duration = durationMin(seg.departsAt, seg.arrivesAt);
  return (
    <div className="bg-white border-[0.5px] border-black/[0.08] rounded-[14px] px-6 py-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-[10px]">
      <p className="text-[11px] text-[#888] mb-3">{label}</p>
      <div className="flex items-center gap-5 flex-wrap">
        <div className="shrink-0 min-w-[100px]">
          <p className="text-[22px] font-bold text-[#1A1A1A] tracking-[-0.5px] leading-none">{seg.origin}</p>
          <p className="text-[11px] text-[#888] mt-0.5">{AIRPORT_NAME[seg.origin] ?? ''}</p>
          <p className="text-[13px] text-[#4A4A4A] font-medium mt-1.5">
            {fmtDateFlight(seg.departsAt)} {fmtTime(seg.departsAt)}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center min-w-[80px]">
          <p className="text-[11px] text-[#888] mb-1">{duration} · 직항</p>
          <div className="w-full h-px bg-[#E0E0E0] relative">
            <span className="absolute -right-1 top-1/2 -translate-y-1/2 bg-white px-1 text-[#5C7BC9]">
              {PLANE_ICON}
            </span>
          </div>
          <p className="text-[11px] text-[#888] mt-1">{seg.airline} {seg.flightNo}</p>
        </div>

        <div className="shrink-0 min-w-[100px]">
          <p className="text-[22px] font-bold text-[#1A1A1A] tracking-[-0.5px] leading-none">{seg.destination}</p>
          <p className="text-[11px] text-[#888] mt-0.5">{AIRPORT_NAME[seg.destination] ?? ''}</p>
          <p className="text-[13px] text-[#4A4A4A] font-medium mt-1.5">
            {fmtDateFlight(seg.arrivesAt)} {fmtTime(seg.arrivesAt)}
          </p>
        </div>

        <div className="shrink-0 text-right min-w-[110px]">
          {showPrice ? (
            <>
              <p className="text-[11px] text-[#888]">
                {isRoundTrip ? '왕복 합계(예상)' : '편도 합계(예상)'}
              </p>
              <p className="text-[18px] font-bold text-[#1A1A1A] mt-0.5">
                ₩{totalAmount.toLocaleString()}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-[#888]">상기 금액에 포함됨</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FlightLeg({ data }: { data: FlightLegData }) {
  const isRoundTrip = data.tripType === 'ROUND_TRIP';
  return (
    <>
      <LegCard
        seg={data.out}
        label="가는편"
        isRoundTrip={isRoundTrip}
        totalAmount={data.totalAmount}
        showPrice={true}
      />
      {isRoundTrip && data.ret && (
        <LegCard
          seg={data.ret}
          label="오는편"
          isRoundTrip={isRoundTrip}
          totalAmount={data.totalAmount}
          showPrice={false}
        />
      )}
    </>
  );
}
