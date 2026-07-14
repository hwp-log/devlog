// per-visit 별점(StorySpot.rating) 서버 방어 — 1~5 정수만 통과, 그 외(범위밖·비정수·null·undefined)는 null.
// 앱단 검증(SpotPopup zod)과 이중화. DB는 plain Int? 라 최종 정합은 여기서 보장.
export function clampRating(r: unknown): number | null {
  return typeof r === 'number' && Number.isInteger(r) && r >= 1 && r <= 5 ? r : null;
}
