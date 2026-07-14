import { prisma } from '../lib/prisma';

// 0192 후속: 기존 coverUrl 27개를 HTTP 실검증 → 죽은 것(404 등)만 null 되돌림 → 플레이스홀더.
// 경로 패턴이 아닌 실로드로 판정(200 + image/*). 재실행 안전(정상 URL은 그대로, 이미 null은 대상 아님).

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function isLoadableImage(url: string): Promise<{ ok: boolean; status: number | string; ct: string }> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
    const ct = res.headers.get('content-type') || '';
    await res.arrayBuffer();
    return { ok: res.status === 200 && ct.startsWith('image/'), status: res.status, ct };
  } catch (e) {
    return { ok: false, status: 'ERR', ct: (e as Error).message.slice(0, 40) };
  }
}

async function main() {
  const rows = await prisma.spot.findMany({
    where: { coverUrl: { not: null } },
    select: { id: true, name: true, coverUrl: true },
  });
  console.log(`coverUrl NOT NULL ${rows.length}개 재검증...\n`);

  const dead: { id: string; name: string; url: string; why: string }[] = [];
  for (const r of rows) {
    const v = await isLoadableImage(r.coverUrl!);
    if (!v.ok) {
      dead.push({ id: r.id, name: r.name, url: r.coverUrl!, why: `${v.status} ${v.ct}` });
      console.log(`  ✗ ${r.name} → ${v.status} ${v.ct}`);
    }
    await delay(120);
  }

  for (const d of dead) {
    await prisma.spot.update({ where: { id: d.id }, data: { coverUrl: null } });
  }

  console.log(`\n=== 되돌림 ${dead.length}개 (coverUrl → null → 플레이스홀더) ===`);
  dead.forEach((d) => console.log(`  ${d.name} (${d.why})\n    ${d.url}`));
  const remain = await prisma.spot.count({ where: { coverUrl: { not: null } } });
  console.log(`\ncoverUrl NOT NULL: ${rows.length} → ${remain}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
