import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../lib/prisma';
import { findNearestTransit } from '../lib/spot/autoTransit';

// 0191 백필: 시드 45개 스팟의 교통 기준점을 findNearestTransit(개선판)으로 채운다.
// 대상 = nearestStation IS NULL AND (name,좌표4) ∈ seed-spots.json → 시드만. 기존 null 8개 무접촉.
// 재실행 안전: IS NULL 필터라 이미 채워진 건 자동 제외. 실패(null)는 skip(0178 실패=null 허용).
// autoTransit 로직 미수정·미복제 — 순수 재사용. server-only는 --conditions=react-server로 우회.

const spotKey = (name: string, lat: number, lng: number) =>
  `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SeedFile = { spots: { name: string; lat: number; lng: number }[] };

async function main() {
  const seed: SeedFile = JSON.parse(
    readFileSync(join(process.cwd(), 'prisma', 'seed-spots.json'), 'utf8'),
  );
  const seedKeys = new Set(seed.spots.map((s) => spotKey(s.name, s.lat, s.lng)));

  const candidates = await prisma.spot.findMany({
    where: { nearestStation: null },
    select: { id: true, name: true, lat: true, lng: true },
  });
  const targets = candidates.filter((s) => seedKeys.has(spotKey(s.name, s.lat, s.lng)));
  console.log(
    `IS NULL ${candidates.length}개 중 시드 대상 ${targets.length}개 ` +
      `(기존 null ${candidates.length - targets.length}개 무접촉)\n`,
  );

  // null 사유 판별: autoTransit의 catch만 console.error를 남기고 90분 컷오프는 안 남김.
  // 호출별로 에러 발화 여부를 캡처 → 'API 실패'(로그 있음) vs '90분 초과'(로그 없음) 구분. (autoTransit 무침습)
  let sawError = false;
  const origErr = console.error;
  console.error = (...args: unknown[]) => {
    sawError = true;
    origErr(...(args as []));
  };

  let ok = 0,
    walk = 0,
    car = 0;
  const updatedIds: string[] = [];
  const failed: { name: string; reason: string }[] = [];

  try {
    for (const s of targets) {
      sawError = false;
      const r = await findNearestTransit(s.lat, s.lng);
      if (!r) {
        const reason = sawError ? 'API 실패' : '90분 초과';
        failed.push({ name: s.name, reason });
        origErr(`  ✗ ${s.name} → null (${reason})`);
        await delay(250);
        continue;
      }
      await prisma.spot.update({
        where: { id: s.id },
        data: {
          nearestStation: r.nearestStation,
          transitMinutes: r.transitMinutes,
          transitMode: r.transitMode,
        },
      });
      ok++;
      updatedIds.push(s.id);
      if (r.transitMode === 'walk') walk++;
      else car++;
      origErr(`  ✓ ${s.name} → ${r.nearestStation} ${r.transitMode} ${r.transitMinutes}분`);
      await delay(250);
    }
  } finally {
    console.error = origErr;
  }

  console.log(`\n=== 요약 ===`);
  console.log(`성공 ${ok}/${targets.length} (커버리지 ${((ok / targets.length) * 100).toFixed(0)}%)`);
  console.log(`transitMode: walk ${walk} / car ${car}`);
  console.log(`실패(null) ${failed.length}:`, JSON.stringify(failed, null, 0));
  console.log(`\n갱신된 spot id(되돌림용): ${JSON.stringify(updatedIds)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
