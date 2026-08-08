import { AIRPORT_NAME, type FlightLegData, type FlightSegmentData } from '@/app/(protected)/my-plan/_components/FlightLeg';
import { FlightLegRow } from '@/app/(protected)/my-plan/_components/FlightLegRow';

// 0492: 공개 상세 항공표. 편별 금액 열 없음 — 스키마에 편별 가격이 없고(왕복 totalAmount 하나),
// 한 행에만 금액을 두면 오는편이 무료로 오독된다. 총액은 그룹 헤더가 접힘 때 한 번만 표기(0567 ②).
// 0569: 조판을 공용 FlightLegRow로 이관 — 작성 폼과 한 벌(카드·면 없음, 편 사이 1px 가로선만).
//   구 4열 행(0514)·모바일 2줄 카드(0515)의 조판 판단은 그 컴포넌트가 승계했다.
//   시각·날짜는 0569부터 실값 — 구 "duration 계산 후 시간·날짜 제거"(page.tsx)는 0492 금액
//   가공과 같은 계열이었고 0557·0558이 그 계열을 뒤집었다(비공개는 글 자체를 가리고, 공개한
//   것은 실값으로). 시각만 남겨둘 이유가 없다.

function fmtDateTime(iso: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}.${d.getDate()} (${wd}) ${hh}:${mm}`;
}

function Leg({ seg, label, last }: { seg: FlightSegmentData; label: string; last: boolean }) {
  return (
    <FlightLegRow
      label={label}
      origin={{
        code: seg.origin,
        name: AIRPORT_NAME[seg.origin] ?? '',
        time: fmtDateTime(seg.departsAt),
      }}
      dest={{
        code: seg.destination,
        name: AIRPORT_NAME[seg.destination] ?? '',
        time: fmtDateTime(seg.arrivesAt),
      }}
      duration={seg.durationLabel}
      flightNo={`${seg.airline} ${seg.flightNo}`}
      last={last}
    />
  );
}

export function PublicFlightTable({ data }: { data: FlightLegData }) {
  // 0562: 오는편이 없으면(편도·ret 누락) 가는편이 곧 마지막 행 — 아래 선 없음.
  const hasReturn = data.tripType === 'ROUND_TRIP' && !!data.ret;
  return (
    <div>
      <Leg seg={data.out} label="가는편" last={!hasReturn} />
      {hasReturn && <Leg seg={data.ret!} label="오는편" last />}
    </div>
  );
}
