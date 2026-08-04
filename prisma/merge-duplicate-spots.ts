import { prisma } from '../lib/prisma';
import { normalizeSpotName } from '../lib/spot/normalize-name';

// 0496 C: 자동 재사용 실패로 생긴 껍데기 user Spot(cover·작품 없음)을 200m+정규화 이름 일치 시드로 병합.
//   PlanSpot.spotId를 시드로 이동(lat/lng는 사용자 좌표 스냅샷 유지) → 껍데기 삭제.
//   안전: 껍데기는 storySpots·spotMovies 0인 순수 플랜 산물만. 시드 행은 무접촉.
const RADIUS_M = 200;
const dry = process.argv.includes('--dry');

function haversineM(a: number, b: number, c: number, d: number) {
  const R = 6371000, r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(c - a), dLng = r(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main() {
  const shells = await prisma.spot.findMany({
    where: { source: 'user', coverUrl: null, spotMovies: { none: {} }, storySpots: { none: {} } },
    select: { id: true, name: true, lat: true, lng: true, _count: { select: { planSpots: true } } },
  });
  const seeds = await prisma.spot.findMany({ where: { source: 'seed' }, select: { id: true, name: true, lat: true, lng: true } });

  console.log(`${dry ? '[DRY] ' : ''}껍데기 후보 ${shells.length}개 검사 (반경 ${RADIUS_M}m + 정규화 이름 일치)\n`);
  let merged = 0, movedRows = 0;

  for (const sh of shells) {
    const seed = seeds
      .map((sd) => ({ sd, d: Math.round(haversineM(sh.lat, sh.lng, sd.lat, sd.lng)) }))
      .filter((x) => x.d <= RADIUS_M && normalizeSpotName(x.sd.name) === normalizeSpotName(sh.name))
      .sort((a, b) => a.d - b.d)[0];
    if (!seed) continue;

    console.log(`  병합: 껍데기 "${sh.name}"(${sh.id}) → 시드 "${seed.sd.name}"(${seed.sd.id}) ${seed.d}m | PlanSpot참조 ${sh._count.planSpots}`);
    if (dry) continue;

    await prisma.$transaction(async (tx) => {
      const upd = await tx.planSpot.updateMany({ where: { spotId: sh.id }, data: { spotId: seed.sd.id } }); // lat/lng 미변경
      movedRows += upd.count;
      await tx.spot.delete({ where: { id: sh.id } });
    });
    merged++;
  }
  console.log(`\n=== 요약 ===`);
  console.log(`${dry ? '[DRY] 병합 예정' : '병합 완료'} ${merged}개 | 이동된 PlanSpot ${movedRows}개`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
