'use server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
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
  // 0392: 재사용 시 공유 Spot의 저장값을 작성 중 시트에 표시(재계산 대신 저장값 정본). 표시 전용.
  address: string | null;
  nearestStation: string | null;
  transitMinutes: number | null;
  transitMode: string | null;
};

const DEFAULT_RADIUS_M = 100; // 실측: 실중복 14m를 여유 포섭 + 대형 랜드마크 핀 편차(~100m) 흡수
const MAX_RADIUS_M = 500; // 0384 상한: 실중복 병합 상한(랜드마크 핀 편차 ~100의 5배). bbox 폭주(데이터 덤프) 차단

export async function findNearbySpots(
  lat: number,
  lng: number,
  radiusM: number = DEFAULT_RADIUS_M,
): Promise<NearbySpot[]> {
  // 0384 인증 가드(throw 가드형, requireAdmin 선례) — prisma는 RLS 우회라 앱 레벨이 유일 통제.
  // 쿼리보다 먼저 = 미인증이면 조회 도달 전 차단. 인증만(role 불검사 — 글 작성자 누구나 근처 후보 정당).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHENTICATED');

  // 0384 상한 clamp(silent, 단일 소스). Number.isFinite 필수 — Math.max(0,NaN)=NaN,
  // Math.min(NaN,500)=NaN이라 산술만으론 clamp가 샘. NaN·±Infinity → 기본 100, 음수 → 0, 과대 → 500.
  const r = Number.isFinite(radiusM)
    ? Math.min(Math.max(0, radiusM), MAX_RADIUS_M)
    : DEFAULT_RADIUS_M;

  const bb = boundingBox(lat, lng, r);
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
      address: true, // 0392: 재사용 표시용(공유 Spot 저장값)
      nearestStation: true,
      transitMinutes: true,
      transitMode: true,
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
      address: s.address,
      nearestStation: s.nearestStation,
      transitMinutes: s.transitMinutes,
      transitMode: s.transitMode,
    }))
    .filter((s) => s.distanceM <= r)
    .sort((a, b) => a.distanceM - b.distanceM);
}
