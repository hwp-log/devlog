import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../lib/prisma';

// 0192 커버 백필: 좌표 기반(KorService2 locationBasedList2)으로 촬영지 대표 이미지를 coverUrl에 채운다.
// 대상 = coverUrl IS NULL AND (name,좌표4) ∈ seed-spots.json → 시드 45. 기존 무접촉.
// title 매칭 게이트(A+B): 완전일치·이름일치는 채택 / 핵심토큰은 dist≤300m만 / 광역·무매칭은 skip(플레이스홀더).
// firstimage(웹)를 https 치환 후 저장. 재실행 안전: coverUrl IS NULL 필터. autoTransit과 무관(server-only 없음).

const KEY = process.env.TOUR_API_KEY!;
const RADIUS = 1000; // 승인: 1km
const CORE_TOKEN_MAX_DIST = 300; // 승인: 핵심토큰은 ≤300m만 (그 밖은 우연 토큰 겹침 → 다른 대상)

const spotKey = (name: string, lat: number, lng: number) =>
  `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const adminSuffix = /[동읍면리가구시군]$/;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type KorItem = { title: string; dist: string; firstimage?: string; firstimage2?: string; contentid?: string };

// 등급: 3 완전, 2 이름(title⊇name 또는 name의 구별부분 포함), 1 핵심토큰(specific), 0 광역(거부), -1 무매칭
function grade(name: string, title: string): number {
  const nN = norm(name), nT = norm(title), tok = norm(name.split(/\s+/)[0]);
  if (nT === nN) return 3;
  if (nT.includes(nN)) return 2;
  if (nN.includes(nT) && nT.length >= 2 && nT !== tok) return 2;
  if (nT.includes(tok)) {
    if (nT === tok && adminSuffix.test(name.split(/\s+/)[0])) return 0; // "부암동" 광역
    return 1;
  }
  return -1;
}
const GRADE_NAME: Record<number, string> = { 3: '완전일치', 2: '이름일치', 1: '핵심토큰', 0: '광역', [-1]: '무매칭' };

async function locationBased(lat: number, lng: number): Promise<KorItem[]> {
  const qs = new URLSearchParams({
    serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'dotrip', _type: 'json',
    numOfRows: '50', pageNo: '1', arrange: 'E', mapX: String(lng), mapY: String(lat), radius: String(RADIUS),
  });
  const url = `https://apis.data.go.kr/B551011/KorService2/locationBasedList2?${qs}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    const text = await res.text();
    let j: unknown;
    try { j = JSON.parse(text); } catch { await delay(300); continue; }
    // @ts-expect-error 동적 JSON
    let items = j?.response?.body?.items?.item;
    if (items && !Array.isArray(items)) items = [items];
    return (items as KorItem[]) || [];
  }
  return [];
}

async function main() {
  const seed = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'seed-spots.json'), 'utf8')) as {
    spots: { name: string; lat: number; lng: number }[];
  };
  const seedKeys = new Set(seed.spots.map((s) => spotKey(s.name, s.lat, s.lng)));

  const candidates = await prisma.spot.findMany({
    where: { coverUrl: null },
    select: { id: true, name: true, lat: true, lng: true },
  });
  const targets = candidates.filter((s) => seedKeys.has(spotKey(s.name, s.lat, s.lng)));
  console.log(`coverUrl IS NULL ${candidates.length}개 중 시드 대상 ${targets.length}개\n`);

  const accepted: { name: string; grade: string; title: string; dist: number }[] = [];
  const rejected: { name: string; reason: string; title?: string; dist?: number }[] = [];
  const updatedIds: string[] = [];

  for (const s of targets) {
    const items = (await locationBased(s.lat, s.lng)).filter((i) => i.firstimage && i.firstimage.trim());
    // 최고 등급 → 동일 등급이면 최근접
    let best: KorItem | null = null, bestGrade = -1;
    for (const i of items) {
      const g = grade(s.name, i.title);
      if (g > bestGrade || (g === bestGrade && best && Number(i.dist) < Number(best.dist))) {
        bestGrade = g; best = i;
      }
    }
    const dist = best ? Math.round(Number(best.dist)) : null;

    // 채택 판정: 완전(3)·이름(2) 무조건 / 핵심토큰(1)은 ≤300m / 광역(0)·무매칭(-1) 거부
    const accept = best && (bestGrade >= 2 || (bestGrade === 1 && dist! <= CORE_TOKEN_MAX_DIST));
    if (!accept || !best) {
      const reason = !items.length ? '이미지 없음'
        : bestGrade === 1 ? `핵심토큰 ${dist}m > ${CORE_TOKEN_MAX_DIST}m`
        : bestGrade === 0 ? '광역일치'
        : '무매칭(인근 무관 POI)';
      rejected.push({ name: s.name, reason, title: best?.title ?? items[0]?.title, dist: dist ?? (items[0] ? Math.round(Number(items[0].dist)) : undefined) });
      console.log(`  ✗ ${s.name} → skip (${reason})`);
      await delay(250);
      continue;
    }

    const coverUrl = best.firstimage!.replace(/^http:\/\//, 'https://');
    await prisma.spot.update({ where: { id: s.id }, data: { coverUrl } });
    updatedIds.push(s.id);
    accepted.push({ name: s.name, grade: GRADE_NAME[bestGrade], title: best.title, dist: dist! });
    console.log(`  ✓ ${s.name} → [${GRADE_NAME[bestGrade]}] ${dist}m "${best.title}"`);
    await delay(250);
  }

  console.log(`\n=== 채택 ${accepted.length}/${targets.length} (${((accepted.length / targets.length) * 100).toFixed(0)}%) ===`);
  accepted.forEach((a) => console.log(`  ✓ ${a.name.padEnd(22)} [${a.grade}] ${a.dist}m "${a.title}"`));
  console.log(`\n=== 거부 ${rejected.length} (플레이스홀더) ===`);
  rejected.forEach((r) => console.log(`  ✗ ${r.name.padEnd(22)} ${r.reason}${r.title ? ` (최근접 "${r.title}"${r.dist != null ? ` ${r.dist}m` : ''})` : ''}`));
  console.log(`\n갱신 spot id(되돌림용): ${JSON.stringify(updatedIds)}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
