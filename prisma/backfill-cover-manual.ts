import { prisma } from '../lib/prisma';

// 0192 최종: 사람이 판단한 4곳만 백필 (searchKeyword2 + 로드검증). 지역/등급 자동게이트 대신
// 승인된 특정 후보(title/addr 지목)를 선택 — 실미도는 2023 행정개편(중구→영종구)로 지역검증 false negative라 수동.
// 로드검증 게이트는 필수 유지("저장됨 ≠ 표시됨"). coverUrl IS NULL만 대상(재실행 안전·무접촉).

const KEY = process.env.TOUR_API_KEY!;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 사람이 채택한 4곳 — (스팟명, 검색어, 목표 title, 목표 주소 조각)
const PICKS = [
  { spot: '경원재 앰배서더 인천', kw: '경원재', titleHas: '경원재', addrHas: '테크노파크로 200' },
  { spot: '미리내 성지', kw: '미리내', titleHas: '미리내성지', addrHas: '미리내성지로 420' },
  { spot: '망상해수욕장', kw: '망상', titleHas: '망상해변', addrHas: '동해대로 6270-10' },
  { spot: '실미도 해수욕장', kw: '실미도', titleHas: '실미도', addrHas: '무의동' },
];

async function isLoadableImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
    const ct = res.headers.get('content-type') || '';
    await res.arrayBuffer();
    return res.status === 200 && ct.startsWith('image/');
  } catch { return false; }
}

type KwItem = { title: string; addr1?: string; firstimage?: string; firstimage2?: string };
async function searchKeyword(keyword: string): Promise<KwItem[]> {
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'dotrip', _type: 'json', numOfRows: '20', pageNo: '1', arrange: 'A', keyword });
  for (let a = 0; a < 3; a++) {
    const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?${qs}`);
    const text = await res.text(); let j: unknown;
    try { j = JSON.parse(text); } catch { await delay(300); continue; }
    // @ts-expect-error TourAPI 응답(unknown)의 중첩 접근 — 바로 아래에서 배열 정규화 + 타입 단언으로 처리하므로 안전
    let items = j?.response?.body?.items?.item; if (items && !Array.isArray(items)) items = [items];
    return (items as KwItem[]) || [];
  }
  return [];
}

async function main() {
  const done: { spot: string; title: string; url: string }[] = [];
  const failed: { spot: string; reason: string }[] = [];

  for (const p of PICKS) {
    const s = await prisma.spot.findFirst({ where: { name: p.spot, coverUrl: null }, select: { id: true, name: true } });
    if (!s) { failed.push({ spot: p.spot, reason: '대상 아님(이미 커버 있거나 없음)' }); console.log(`  = ${p.spot} skip (대상 아님)`); continue; }

    const items = (await searchKeyword(p.kw)).filter((i) => i.firstimage && i.firstimage.trim());
    // 목표 후보 선택: title 정확 일치 우선 → title 포함 + 주소 조각 일치
    const th = norm(p.titleHas);
    let hit = items.find((i) => norm(i.title) === th);
    if (!hit) hit = items.find((i) => norm(i.title).includes(th) && (i.addr1 || '').includes(p.addrHas));
    if (!hit) { failed.push({ spot: p.spot, reason: `후보 "${p.titleHas}" 미발견` }); console.log(`  ✗ ${p.spot} — 후보 미발견`); await delay(200); continue; }

    const url = hit.firstimage!.replace(/^http:\/\//, 'https://');
    if (!(await isLoadableImage(url))) { failed.push({ spot: p.spot, reason: '로드 실패' }); console.log(`  ✗ ${p.spot} — 로드 실패`); await delay(200); continue; }

    await prisma.spot.update({ where: { id: s.id }, data: { coverUrl: url } });
    done.push({ spot: p.spot, title: hit.title, url });
    console.log(`  ✓ ${p.spot} → "${hit.title}" @ ${hit.addr1} (thumb:${hit.firstimage2 ? 'Y' : 'N'})`);
    await delay(250);
  }

  console.log(`\n=== 채택 ${done.length}/4 ===`);
  done.forEach((d) => console.log(`  ✓ ${d.spot.padEnd(16)} "${d.title}"\n     ${d.url}`));
  if (failed.length) { console.log(`\n실패/스킵 ${failed.length}:`); failed.forEach((f) => console.log(`  - ${f.spot}: ${f.reason}`)); }
  const total = await prisma.spot.count({ where: { coverUrl: { not: null } } });
  console.log(`\ncoverUrl NOT NULL: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
