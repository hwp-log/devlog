import { prisma } from '../lib/prisma';
import { pickRegionCover, normalizeRegionKey } from '../lib/plan/region-cover';

// 0405 백필: coverUrl IS NULL 인 기존 플랜에 region 기반 커버(pickRegionCover)를 채운다.
// 대상 = coverUrl null. 재실행 안전: IS NULL 필터라 이미 채워진 행은 자동 제외.
// 지역 매칭 실패(null)는 skip(coverUrl 유지). region-covers.json 미수정, DDL 없음.
// 0409: --force 옵션 — 전체 플랜을 대상으로 커버 강제 재부여(풀 갱신 반영). 기본 동작(null만 채움)은 불변.
//   force여도 지역 매칭 실패 행은 skip(기존 커버 보존 — null로 지우지 않음).

const force = process.argv.includes('--force');

async function main() {
  const targets = await prisma.myPlan.findMany({
    where: force ? {} : { coverUrl: null },
    select: { id: true, title: true, region: true },
  });
  console.log(`${force ? '[--force] 전체' : 'coverUrl IS NULL'} ${targets.length}개\n`);

  let filled = 0;
  const skipped: { title: string; region: string | null }[] = [];
  const updatedIds: string[] = [];

  for (const p of targets) {
    const key = normalizeRegionKey(p.region);
    const cover = key ? pickRegionCover(p.region) : null;
    if (!cover) {
      skipped.push({ title: p.title, region: p.region });
      console.log(`  ✗ ${p.title} skip (지역 매칭 실패: region=${JSON.stringify(p.region)})`);
      continue;
    }
    await prisma.myPlan.update({ where: { id: p.id }, data: { coverUrl: cover } });
    filled++;
    updatedIds.push(p.id);
    console.log(`  ✓ ${p.title} → [${key}] ${cover}`);
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
