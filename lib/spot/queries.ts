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
  movie: { id: string; title: string };
  author: { nickname: string; avatarUrl: string | null };
};

export async function fetchSpotFinderSpots(): Promise<SpotFinderSpot[]> {
  const spots = await prisma.spot.findMany({
    where: { movieId: { not: null } },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      review: true,
      photoUrl: true,
      createdAt: true,
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
    movie: s.movie!,
    author: s.story.user,
  }));
}
