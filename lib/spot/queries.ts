import 'server-only';
import { prisma } from '@/lib/prisma';

export type SpotFinderSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  review: string | null;
  photoUrl: string | null;
  createdAt: Date; // 칩 정렬 2차 기준(작품별 최근 등록) 집계용 — RSC가 Date 직렬화 지원
  nearestStation: string | null; // 교통 기준점 (수동 입력 v1)
  transitMinutes: number | null;
  movie: { id: string; title: string };
  author: { nickname: string; avatarUrl: string | null };
};

export async function fetchSpotFinderSpots(): Promise<SpotFinderSpot[]> {
  const spots = await prisma.spot.findMany({
    where: { movieId: { not: null } },
    orderBy: { createdAt: 'desc' }, // 리스트 최신순 — 순서는 소스에서 단일 결정 (클라 재정렬 금지)
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      review: true,
      photoUrl: true,
      createdAt: true,
      nearestStation: true,
      transitMinutes: true,
      movie: { select: { id: true, title: true } },
      story: { select: { user: { select: { nickname: true, avatarUrl: true } } } },
    },
  });

  return spots.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    review: s.review,
    photoUrl: s.photoUrl,
    createdAt: s.createdAt,
    nearestStation: s.nearestStation,
    transitMinutes: s.transitMinutes,
    movie: s.movie!,
    author: s.story!.user, // S1: storyId nullable화 타입 파급 — movieId not null 스팟은 전부 story 보유 (s.movie! 대칭)
  }));
}
