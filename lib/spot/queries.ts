import 'server-only';
import { prisma } from '@/lib/prisma';
import { extractTextPreview } from '@/lib/story/extract-thumbnail';

// 우측 패널 "다녀온 이야기" 카드 — 스토리 자신의 사진(StorySpot.photoUrl, 도출 안 함) + 발췌 + 좋아요
export type SpotFinderStory = {
  id: string;
  excerpt: string;
  photoUrl: string | null; // 이 (스팟, 스토리) 방문의 사진 — story_spots.photo_url
  createdAt: Date;
  author: { nickname: string; avatarUrl: string | null };
  likeCount: number;
};

export type SpotFinderSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  review: string | null;
  createdAt: Date; // 리스트/칩 정렬 기준 — 순서는 소스에서 단일 결정 (클라 재정렬 금지)
  nearestStation: string | null; // 교통 기준점 (수동 입력 v1)
  transitMinutes: number | null;
  thumbnailUrl: string | null; // 도출: 사진 있는 최신 스토리의 story_spots.photo_url (좌측·마커·히어로 공용)
  movies: { id: string; title: string }[]; // 최신 연결순 (spot_movies.created_at desc)
  primaryMovie: { id: string; title: string }; // 대표 = movies[0]. where 보장으로 항상 존재
  extraMovieCount: number; // 배지 "+N"
  movieCount: number;
  author: { nickname: string; avatarUrl: string | null }; // 최신 스토리 작성자
  extraAuthorCount: number; // "외 N명" — 고유 작성자(userId) 기준
  storyCount: number;
  stories: SpotFinderStory[]; // 다녀온 이야기 (최신순)
};

// N+1 회피: 단일 findMany + 중첩 select. Prisma가 관계당 배치 SQL(WHERE IN)로 로드 →
// 스팟 개수와 무관하게 쿼리 수 상수 (스팟마다 개별 조회 없음). 파생은 로드된 데이터의 JS map/find.
export async function fetchSpotFinderSpots(): Promise<SpotFinderSpot[]> {
  const rows = await prisma.spot.findMany({
    where: { spotMovies: { some: {} } }, // S2: 구 movieId not null 대체 (작품 연결이 하나라도 있는 스팟)
    orderBy: { createdAt: 'desc' }, // 리스트 정렬축 유지 (S2.5 소관 — 변경 금지)
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      review: true,
      createdAt: true,
      nearestStation: true,
      transitMinutes: true,
      spotMovies: {
        orderBy: { createdAt: 'desc' }, // 최신 연결순 (S1 백필서 created_at 승계 → 결정적)
        select: { movie: { select: { id: true, title: true } } },
      },
      storySpots: {
        orderBy: { story: { createdAt: 'desc' } }, // 최신 스토리 우선 (to-one 정렬). 파생은 아래 JS 정렬로 재보장 — 이 DB 정렬에 비의존
        select: {
          photoUrl: true,
          story: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              user: { select: { id: true, nickname: true, avatarUrl: true } },
              _count: { select: { likes: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((s) => {
    const movies = s.spotMovies.map((sm) => sm.movie);
    // 파생이 DB 정렬에 의존하지 않도록 코드가 최신순을 보장 — S3 다중 스토리에서 Prisma 정렬 누락 시
    // "엉뚱한 썸네일·대표 작성자"로 조용히 틀리는 것을 차단. 스팟 내부 배열 정렬(리스트 재정렬 아님).
    const storySpots = [...s.storySpots].sort(
      (a, b) => b.story.createdAt.getTime() - a.story.createdAt.getTime(),
    );
    // 사진 있는 최신 스토리 (정렬 최신순 → find가 곧 폴백 체인). 전부 없으면 null → 플레이스홀더
    const thumbnailUrl = storySpots.find((ss) => ss.photoUrl)?.photoUrl ?? null;
    const latestAuthor = storySpots[0]?.story.user ?? null;
    const authorCount = new Set(storySpots.map((ss) => ss.story.user.id)).size;

    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      review: s.review,
      createdAt: s.createdAt,
      nearestStation: s.nearestStation,
      transitMinutes: s.transitMinutes,
      thumbnailUrl,
      movies,
      primaryMovie: movies[0],
      extraMovieCount: movies.length - 1,
      movieCount: movies.length,
      author: latestAuthor
        ? { nickname: latestAuthor.nickname, avatarUrl: latestAuthor.avatarUrl }
        : { nickname: '?', avatarUrl: null }, // storySpots 부재 방어 (공유 스팟 미래 대비)
      extraAuthorCount: Math.max(0, authorCount - 1),
      storyCount: storySpots.length,
      stories: storySpots.map((ss) => ({
        id: ss.story.id,
        excerpt: extractTextPreview(ss.story.content),
        photoUrl: ss.photoUrl,
        createdAt: ss.story.createdAt,
        author: { nickname: ss.story.user.nickname, avatarUrl: ss.story.user.avatarUrl },
        likeCount: ss.story._count.likes,
      })),
    };
  });
}
