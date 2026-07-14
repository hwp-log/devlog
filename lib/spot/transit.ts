// 교통 기준점 표시 — 이동수단(mode)은 저장된 transitMode 우선.
// 거리 기반 판정 도입으로 이름 파생이 불가능해져("강릉역" 차로 vs "시청역" 도보 구분 불가)
// 저장이 정당해진 시점 (원 주석이 예고한 전환). 레거시 행(transitMode=null)은 기존 이름 규칙 폴백.
export function formatTransit(
  nearestStation: string,
  transitMinutes: number,
  transitMode?: string | null,
): string {
  const mode = transitMode
    ? transitMode === 'car' ? '차로' : '도보'
    : nearestStation.endsWith('공항') ? '차로' : '도보'; // 폴백: 저장값 없는 기존 행
  // "약" = 직선거리 기반 추정치의 정직 표기 (자동 계산 v1 — 실경로 API 미사용)
  return `${nearestStation}에서 ${mode} 약 ${transitMinutes}분`;
}
