// 0496: 스팟 이름 정규화 — 공백 제거 + 소문자(pick-cover의 작품명 정규화와 동형).
//   자동 재사용의 이름 게이트에 사용. 향후 스토리 등에서도 공용으로 쓸 수 있게 분리.
export function normalizeSpotName(s: string): string {
  return s.replace(/\s/g, '').toLowerCase();
}
