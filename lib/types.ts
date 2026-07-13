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
};
