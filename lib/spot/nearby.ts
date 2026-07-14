'use server';
import { prisma } from '@/lib/prisma';
import { haversineM, boundingBox } from './geo';

// S3-a: 마커 좌표 반경 내 기존 Spot 후보 (중복 스팟 재사용용). 좌표만으로 후보 선정 —
// 이름 유사도는 게이트로 안 씀("롯데월드몰"≠"롯데월드타워"를 놓치므로). 채택은 사람 판단.
// bbox 프리필터 + haversineM 정밀. PostGIS 미도입(데이터 소규모). SpotFinder 읽기 경로 무관.

export type NearbySpot = {
  spotId: string;
  name: string;
  distanceM: number;
  movies: string[];
  storyCount: number;
};

const DEFAULT_RADIUS_M = 100; // 실측: 실중복 14m를 여유 포섭 + 대형 랜드마크 핀 편차(~100m) 흡수

export async function findNearbySpots(
  lat: number,
  lng: number,
  radiusM: number = DEFAULT_RADIUS_M,
): Promise<NearbySpot[]> {
  const bb = boundingBox(lat, lng, radiusM);
  const rows = await prisma.spot.findMany({
    where: {
      lat: { gte: bb.minLat, lte: bb.maxLat },
      lng: { gte: bb.minLng, lte: bb.maxLng },
    },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      spotMovies: { orderBy: { createdAt: 'desc' }, select: { movie: { select: { title: true } } } }, // 최신 연결 대표(0185)와 정합
      _count: { select: { storySpots: true } },
    },
  });

  return rows
    .map((s) => ({
      spotId: s.id,
      name: s.name,
      distanceM: Math.round(haversineM(lat, lng, s.lat, s.lng)),
      movies: s.spotMovies.map((sm) => sm.movie.title),
      storyCount: s._count.storySpots,
    }))
    .filter((s) => s.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}
