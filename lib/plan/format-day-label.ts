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
