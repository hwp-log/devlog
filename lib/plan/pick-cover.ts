import { prisma } from '../prisma';
import { normalizeRegionKey, regionCoverPool } from './region-cover';
import { addressMatchesRegionKey } from './spot-addr-prefix';

// 0410: 플랜 카드 커버 선택. 후보 = 작품 촬영지 커버(SpotMovie→Spot.coverUrl) + 지역 풀(region-covers.json).
// 전체 플랜 기준 사용 횟수가 최소인 후보를 뽑되, 최소 집합에 작품 후보가 있으면 작품 후보 우선.
// 런타임 TourAPI 호출 없음(DB + 시드 JSON만). 좌표 폴백 없음. server-only 미부여(backfill 스크립트가 import).
// 0423: 작품 후보를 플랜 region의 시·도 촬영지로 제한 — 지역 칩과 커버 사진의 지역 어긋남 방지.
// region이 풀 키로 해석되지 않으면(예: "경주") 작품 후보도 0.

const normalize = (s: string) => s.replace(/\s/g, '').toLowerCase();

export type CoverCandidates = {
  movieCovers: string[];
  regionCovers: string[];
  all: string[];
};

// 작품 후보 + 지역 후보 수집(URL 기준 중복 제거, 작품 후보 우선 순서).
export async function collectCandidates(
  movie: string | null | undefined,
  region: string | null | undefined,
): Promise<CoverCandidates> {
  // 작품 후보: movie 공백 전부 제거 + 소문자화로 Movie.title(동일 정규화)과 비교.
  // 그중 Spot.address의 시·도가 플랜 region의 풀 키와 일치하는 촬영지만.
  const movieCovers: string[] = [];
  const regionKey = normalizeRegionKey(region);
  if (movie && movie.trim() && regionKey) {
    const target = normalize(movie);
    const movies = await prisma.movie.findMany({ select: { id: true, title: true } });
    const ids = movies.filter((m) => normalize(m.title) === target).map((m) => m.id);
    if (ids.length) {
      const links = await prisma.spotMovie.findMany({
        where: { movieId: { in: ids } },
        select: { spot: { select: { coverUrl: true, address: true } } },
      });
      const seen = new Set<string>();
      for (const l of links) {
        const u = l.spot.coverUrl;
        if (!u || seen.has(u)) continue;
        if (!addressMatchesRegionKey(l.spot.address, regionKey)) continue;
        seen.add(u);
        movieCovers.push(u);
      }
    }
  }

  // 지역 후보: 기존 지역 풀 로직 재사용
  const regionCovers = [...regionCoverPool(region)];

  // 합집합(URL 중복 제거)
  const seenAll = new Set<string>();
  const all: string[] = [];
  for (const u of [...movieCovers, ...regionCovers]) {
    if (!seenAll.has(u)) { seenAll.add(u); all.push(u); }
  }
  return { movieCovers, regionCovers, all };
}

// 후보 중 전체 플랜 사용 횟수가 최소인 것을 선택.
// excludePlanId: 사용 횟수 집계에서 제외할 플랜(자기 자신 재부여 시). 생성 시엔 미지정(아직 행 없음).
export async function pickPlanCover(
  movie: string | null | undefined,
  region: string | null | undefined,
  excludePlanId?: string,
): Promise<string | null> {
  const { movieCovers, all } = await collectCandidates(movie, region);
  if (all.length === 0) return null;

  // 후보 URL만 집계(전체 행 미수집). 집계에 없는 URL은 0회로 취급.
  const grouped = await prisma.myPlan.groupBy({
    by: ['coverUrl'],
    where: {
      coverUrl: { in: all },
      ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
    },
    _count: { coverUrl: true },
  });
  const countOf = new Map<string, number>();
  for (const g of grouped) {
    if (g.coverUrl) countOf.set(g.coverUrl, g._count.coverUrl);
  }

  const minCount = Math.min(...all.map((u) => countOf.get(u) ?? 0));
  const minUrls = all.filter((u) => (countOf.get(u) ?? 0) === minCount);

  // 최소 집합에 작품 후보가 있으면 작품 후보 중 무작위, 없으면 남은 것 중 무작위
  const movieSet = new Set(movieCovers);
  const movieMin = minUrls.filter((u) => movieSet.has(u));
  const pickFrom = movieMin.length > 0 ? movieMin : minUrls;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)];
}
