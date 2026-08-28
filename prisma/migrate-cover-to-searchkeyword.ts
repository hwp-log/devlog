import { prisma } from '../lib/prisma';

// 0192 경로 C 후속: PhotoGallery로 채운 커버(cms2/website·cms/resource_photo)를 searchKeyword2의
// 살아있는 cms/resource CDN으로 이전(트리 은퇴 리스크 회피). 지역+로드 검증 통과 & cms/resource인 대체만 교체.
// 대체 없거나 검증 실패면 기존 유지(살아있는 것을 죽은 걸로 바꾸지 않음). 재실행 안전.

const KEY = process.env.TOUR_API_KEY!;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const adminSuffix = /[동읍면리가구시군]$/;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function isLoadableImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
    const ct = res.headers.get('content-type') || '';
    await res.arrayBuffer();
    return res.status === 200 && ct.startsWith('image/');
  } catch { return false; }
}
function grade(name: string, title: string): number {
  const nN = norm(name), nT = norm(title), tok = norm(name.split(/\s+/)[0]);
  if (nT === nN) return 3;
  if (nT.includes(nN)) return 2;
  if (nN.includes(nT) && nT.length >= 2 && nT !== tok) return 2;
  if (nT.includes(tok)) { if (nT === tok && adminSuffix.test(name.split(/\s+/)[0])) return 0; return 1; }
  return -1;
}
const PROV: [string, string][] = [['서울','서울'],['부산','부산'],['인천','인천'],['대구','대구'],['대전','대전'],['울산','울산'],['세종','세종'],['경기','경기'],['강원','강원'],['충청북','충북'],['충북','충북'],['충청남','충남'],['충남','충남'],['전라북','전북'],['전북','전북'],['전라남','전남'],['전남','전남'],['경상북','경북'],['경북','경북'],['경상남','경남'],['경남','경남'],['제주','제주'],['광주','광주']];
const prov = (a?: string | null) => { if (!a) return null; for (const [k, v] of PROV) if (a.startsWith(k)) return v; return null; };
const sgg = (a?: string | null) => { if (!a) return null; const t = a.split(/\s+/); for (let i = 1; i < t.length; i++) if (/(시|군|구)$/.test(t[i])) return t[i]; return null; };
const regionMatch = (a?: string | null, b?: string | null) => { const pa=prov(a),pb=prov(b),sa=sgg(a),sb=sgg(b); return !!(pa&&pb&&pa===pb&&sa&&sb&&sa===sb); };

type KwItem = { title: string; addr1?: string; firstimage?: string };
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
const cdnOf = (u: string) => (u.match(/or\.kr\/([^/]+\/[^/]+)\//) || [])[1] || '?';

async function main() {
  // PhotoGallery 소스 = cms2/website 또는 cms/resource_photo 경로
  const all = await prisma.spot.findMany({ where: { coverUrl: { not: null } }, select: { id: true, name: true, address: true, coverUrl: true } });
  const pgCovers = all.filter((s) => /cms2\/website|cms\/resource_photo/.test(s.coverUrl!));
  console.log(`PhotoGallery 소스 커버 ${pgCovers.length}곳 검토 (현재 CDN 표기)\n`);

  const migrated: { name: string; from: string; to: string }[] = [];
  const kept: { name: string; cdn: string; reason: string }[] = [];

  for (const s of pgCovers) {
    const curCdn = cdnOf(s.coverUrl!);
    const items = (await searchKeyword(s.name)).filter((i) => i.firstimage && i.firstimage.trim());
    const named = items.filter((i) => grade(s.name, i.title) >= 1);
    const hit = named.find((i) => regionMatch(s.address, i.addr1));
    if (!hit) { kept.push({ name: s.name, cdn: curCdn, reason: 'searchKeyword2 대체 없음(지역/이름 미매칭)' }); console.log(`  = ${s.name} 유지 (${curCdn}) — 대체 없음`); await delay(200); continue; }
    const newUrl = hit.firstimage!.replace(/^http:\/\//, 'https://');
    const newCdn = cdnOf(newUrl);
    if (newCdn !== 'cms/resource') { kept.push({ name: s.name, cdn: curCdn, reason: `대체도 ${newCdn}(살아있는 CDN 아님)` }); console.log(`  = ${s.name} 유지 — 대체가 ${newCdn}`); await delay(200); continue; }
    if (!(await isLoadableImage(newUrl))) { kept.push({ name: s.name, cdn: curCdn, reason: '대체 로드 실패' }); console.log(`  = ${s.name} 유지 — 대체 로드 실패`); await delay(200); continue; }
    await prisma.spot.update({ where: { id: s.id }, data: { coverUrl: newUrl } });
    migrated.push({ name: s.name, from: curCdn, to: newCdn });
    console.log(`  ✓ ${s.name} 이전: ${curCdn} → ${newCdn}  "${hit.title}"`);
    await delay(250);
  }

  console.log(`\n=== 이전 ${migrated.length} / 유지 ${kept.length} ===`);
  migrated.forEach((m) => console.log(`  ✓ ${m.name.padEnd(16)} ${m.from} → ${m.to}`));
  kept.forEach((k) => console.log(`  = ${k.name.padEnd(16)} 유지(${k.cdn}) — ${k.reason}`));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
