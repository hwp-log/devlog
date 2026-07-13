// 교통 기준점 표시 파생 — 이동수단(mode)은 저장하지 않고 이름에서 파생 (단일 소스 + 파생 원칙).
// 규칙: 기준점 이름이 "공항"으로 끝나면 차로, 그 외(역 등) 도보.
// 한계: 버스터미널·선착장 등 차로/기타 수단 기준점이 등장하면 오표기 — 그 시점에
// transitMode enum 필드 추가로 전환 (파생 불가능해지는 순간 저장이 정당해짐).
export function formatTransit(nearestStation: string, transitMinutes: number): string {
  const mode = nearestStation.endsWith('공항') ? '차로' : '도보';
  // "약" = 직선거리 기반 추정치의 정직 표기 (자동 계산 v1 — 실경로 API 미사용)
  return `${nearestStation}에서 ${mode} 약 ${transitMinutes}분`;
}
