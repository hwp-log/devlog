// 0505: 일자 라벨 단일 소스 — "M.D (요일)". Day 탭·비용 항목 목록이 같은 포맷을 쓰도록 여기서만 정의.
//   startDate가 있을 때만 실날짜, 없으면 호출부가 "DAY N"으로 폴백(이 함수는 폴백을 모름).
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDayLabel(date: Date): string {
  return `${date.getMonth() + 1}.${date.getDate()} (${WEEKDAY_KO[date.getDay()]})`;
}

// 시작일 기준 n일 뒤(로컬 자정 오프셋 — 기존 Day 탭 계산과 동일 관용구).
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

// 0562(B): 기간 라벨 — 지표 밴드 "기간" 칸의 단일 소스. 읽기 상세(PlanFinderDetail)에 로컬
//   상수로 있던 것을 승격했다. 작성 폼도 같은 밴드를 쓰므로(C 사이클) 두 화면이 같은 문구를
//   내야 한다 — 공유하는 건 **문자열 산출뿐**이고 밴드 조판은 각 화면이 따로 짠다
//   (0556 결정: 폼 정합은 조판·용어만, 컴포넌트 공유 금지).
//   날짜 미설정은 이 함수가 모른다 — dayCount 폴백 1과 "당일"이 구분되지 않으므로
//   호출부가 startDate·endDate 유무로 먼저 판정해 "—"를 쓴다.
export function formatDurationLabel(dayCount: number): string {
  return dayCount > 1 ? `${dayCount - 1}박 ${dayCount}일` : '당일';
}
