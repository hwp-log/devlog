export type LocalSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  photoUrl?: string | null;
  review?: string | null;
  address?: string | null;
  description?: string | null;
  movieId?: string | null;
  movieTitle?: string | null;
  nearestStation?: string | null; // 교통 기준점 이름 (수동 입력 v1)
  transitMinutes?: number | null; // 기준점에서 소요 분
  transitMode?: string | null; // 'walk'|'car' — 거리 기반 판정 저장값 (없으면 formatTransit이 이름 규칙 폴백)
  rating?: number | null; // per-visit 별점 1~5 (StorySpot.rating). 편집 왕복 보존 — payload에 실어야 함
};
