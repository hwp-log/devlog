import 'server-only';
import { prisma } from '@/lib/prisma';

export type SpotFinderSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  review: string | null;
  photoUrl: string | null;
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
    movie: s.movie!,
    author: s.story.user,
  }));
}
