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
  movieId?: string | null; // 대표 작품(spot_movies 최신 연결 = 0185 규칙). 편집 picker는 단수(dual-write)
  movieTitle?: string | null;
  extraMovieCount?: number | null; // 대표 외 추가 작품 수 ("+N" 표시용, spot_movies 조인 파생 — readOnly 표시 전용)
  nearestStation?: string | null; // 교통 기준점 이름 (수동 입력 v1)
  transitMinutes?: number | null; // 기준점에서 소요 분
  transitMode?: string | null; // 'walk'|'car' — 거리 기반 판정 저장값 (없으면 formatTransit이 이름 규칙 폴백)
  rating?: number | null; // per-visit 별점 1~5 (StorySpot.rating). 편집 왕복 보존 — payload에 실어야 함
  reusedSpotId?: string | null; // S3-a: 기존 공유 Spot 재사용 시 그 id. 세팅되면 Spot 생성·수정 안 하고 조인만
};
