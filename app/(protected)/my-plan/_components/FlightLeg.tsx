export type FlightSegmentData = {
  origin: string;
  destination: string;
  departsAt: string;
  arrivesAt: string;
  airline: string;
  flightNo: string;
  durationLabel?: string;  // 서버 계산값(읽기) — 폼은 departsAt·arrivesAt에서 직접 산출
};

export type FlightLegData = {
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  totalAmount: number;
  out: FlightSegmentData;
  ret?: FlightSegmentData;
};

export const AIRPORT_NAME: Record<string, string> = {
  ICN: '인천 국제', GMP: '서울 김포', PUS: '부산 김해', CJU: '제주',
  TAE: '대구', CJJ: '청주',
  NRT: '도쿄 나리타', HND: '도쿄 하네다', KIX: '오사카 간사이',
  FUK: '후쿠오카', OKA: '오키나와 나하', NGO: '나고야 중부', CTS: '삿포로 신치토세',
  BKK: '방콕 수완나품', HKT: '푸켓', SIN: '싱가포르 창이',
  HKG: '홍콩', TPE: '타이베이 타오위안', PEK: '베이징 수도',
  PVG: '상하이 푸동', JFK: 'New York JFK', LAX: 'LA 국제',
};

// 0569: 이 파일은 **타입·상수 모듈**이다. 구 FlightLeg/LegCard(카드 2장 조판)는 폐기됐다 —
//   읽기·폼이 공용 FlightLegRow 한 벌을 쓰면서 소비처가 0이 됐고, 카드 면·그림자는 0569 ①
//   ("형제 그룹이 선과 여백만으로 구획되는데 여기만 면을 깔면 재질이 갈린다")로 금지됐다.
//   같이 죽은 것: fmtTime·fmtDateFlight·durationMin(카드 전용 포매터, 각 화면이 자기 것을 가짐),
//   showDetails 분기(이미 소비처 0이었다).
//   파일명을 안 바꾼 이유: import 4곳의 경로만 흔들고 얻는 게 없다. 내용은 이 주석이 말한다.

export const PLANE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
  </svg>
);

