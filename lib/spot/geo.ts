// 순수 지오 유틸 (server-only 아님 — 재사용처: autoTransit 소요분 추정, nearby 근접 조회).
// haversineM은 0178 autoTransit에서 이관 — 복제 방지 단일 소스.

/** 두 위경도 간 대권 거리(m). */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 반경(m) → 위경도 bbox (근접 조회 프리필터용). 1도 ≈ 111km, 경도는 위도에 따라 cos 축소. */
export function boundingBox(lat: number, lng: number, radiusM: number) {
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}
