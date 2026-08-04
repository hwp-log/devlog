import { prisma } from '../lib/prisma';
import { pickPlanCover, collectCandidates, firstOwnSpotCover } from '../lib/plan/pick-cover';
import { normalizeRegionKey } from '../lib/plan/region-cover';
import { inferRegionKey, inferMovieTitle } from '../lib/plan/infer-plan-meta';

// 0405 백필: coverUrl IS NULL 인 기존 플랜에 커버를 채운다. 대상 = coverUrl null.
// 재실행 안전: IS NULL 필터라 이미 채워진 행은 자동 제외. 매칭 실패(null)는 skip(기존 커버 유지).
// 0409: --force 옵션 — 전체 플랜 강제 재부여(풀 갱신 반영). 기본 동작(null만 채움)은 불변.
// 0410: 커버 선택을 pickPlanCover(최소 사용 후보, 작품+지역)로 교체. force 시 자기 자신 id를 집계에서 제외.

const force = process.argv.includes('--force');

async function main() {
  const targets = await prisma.myPlan.findMany({
    where: force ? {} : { coverUrl: null },
    select: {
      id: true, title: true, movie: true, region: true,
      // 0495: 담긴 Spot에서 자기 커버(우선순위 1)·region/movie 추론(생성 후라 PlanSpot·Spot이 DB에 있음).
      spots: {
        where: { spotId: { not: null } },
        select: { order: true, spot: { select: { coverUrl: true, address: true, spotMovies: { select: { movie: { select: { title: true } } } } } } },
      },
    },
  });
  console.log(`${force ? '[--force] 전체' : 'coverUrl IS NULL'} ${targets.length}개\n`);

  let filled = 0;
  const skipped: { title: string; movie: string | null; region: string | null }[] = [];
  const updatedIds: string[] = [];

  for (const p of targets) {
    // 사용자 입력 우선, 해석 실패 시에만 추론(저장값은 미변경 — coverUrl만 갱신).
    const region = normalizeRegionKey(p.region)
      ? p.region
      : inferRegionKey(p.spots.map((s) => s.spot?.address));
    const movie = p.movie?.trim()
      ? p.movie
      : inferMovieTitle(p.spots.flatMap((s) => s.spot?.spotMovies.map((m) => m.movie.title) ?? []));

    // 우선순위 1: 담은 Spot 커버(order 최소). 없으면 작품→지역(pickPlanCover).
    const ownSpots = p.spots.map((s) => ({ order: s.order, coverUrl: s.spot?.coverUrl ?? null }));
    const own = firstOwnSpotCover(ownSpots);
    const { movieCovers, regionCovers } = await collectCandidates(movie, region);
    const cover = own ?? (await pickPlanCover(movie, region, p.id));
    if (!cover) {
      skipped.push({ title: p.title, movie: p.movie, region: p.region });
      console.log(`  ✗ ${p.title} skip (후보 0: region=${JSON.stringify(p.region)}→${region ?? 'null'} movie=${JSON.stringify(p.movie)}→${movie ?? 'null'})`);
      continue;
    }
    await prisma.myPlan.update({ where: { id: p.id }, data: { coverUrl: cover } });
    filled++;
    updatedIds.push(p.id);
    const kind = own ? '자기커버' : movieCovers.includes(cover) ? '작품' : '지역';
    console.log(`  ✓ ${p.title} [region=${JSON.stringify(p.region)}→${region ?? 'null'} movie=${JSON.stringify(p.movie)}→${movie ?? 'null'}] 후보 작품${movieCovers.length}/지역${regionCovers.length} → [${kind}] ${cover}`);
  }

  console.log(`\n=== 요약 ===`);
  console.log(`채움 ${filled}/${targets.length} / 스킵(매칭실패) ${skipped.length}`);
  console.log(`스킵 목록:`, JSON.stringify(skipped, null, 0));
  console.log(`\n갱신된 plan id(되돌림용): ${JSON.stringify(updatedIds)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
