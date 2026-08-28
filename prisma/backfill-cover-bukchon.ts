import { prisma } from '../lib/prisma';

// 0192 최종 단일: 북촌로6길 커버. 북촌한옥마을 구역 내 골목이며 관광공사엔 "북촌한옥마을"로 등록.
// 사람 지정 검색어 "북촌한옥마을" 하나만. 지역검증(서울 종로구) + 로드검증(200+image/*, 필수) 통과 시 저장.
// 없으면 확장 없이 종료. (한강 여의도→"한강의 밤"과 같은 층 — 같은 구역 대표컷)

const KEY = process.env.TOUR_API_KEY!;
const KEYWORD = '북촌한옥마을';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PROV: [string, string][] = [['서울','서울'],['부산','부산'],['인천','인천'],['대구','대구'],['대전','대전'],['울산','울산'],['세종','세종'],['경기','경기'],['강원','강원'],['충청북','충북'],['충북','충북'],['충청남','충남'],['충남','충남'],['전라북','전북'],['전북','전북'],['전라남','전남'],['전남','전남'],['경상북','경북'],['경북','경북'],['경상남','경남'],['경남','경남'],['제주','제주'],['광주','광주']];
const prov = (a?: string | null) => { if (!a) return null; for (const [k, v] of PROV) if (a.startsWith(k)) return v; return null; };
const sgg = (a?: string | null) => { if (!a) return null; const t = a.split(/\s+/); for (let i = 1; i < t.length; i++) if (/(시|군|구)$/.test(t[i])) return t[i]; return null; };
const regionMatch = (a?: string | null, b?: string | null) => { const pa=prov(a),pb=prov(b),sa=sgg(a),sb=sgg(b); return !!(pa&&pb&&pa===pb&&sa&&sb&&sa===sb); };
const cdnOf = (u: string) => (u.match(/or\.kr\/([^/]+\/[^/]+)\//) || [])[1] || '?';

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
  const s = await prisma.spot.findFirst({ where: { name: '북촌로6길' }, select: { id: true, coverUrl: true, address: true } });
  if (!s) { console.log('북촌로6길 없음'); return; }
  console.log(`북촌로6길 (주소: ${s.address}) — 현재 coverUrl: ${s.coverUrl ?? 'null'}\n`);
  if (s.coverUrl) { console.log('이미 커버 있음 → 종료(무접촉)'); return; }

  const items = (await searchKeyword(KEYWORD)).filter((i) => i.firstimage && i.firstimage.trim());
  console.log(`[검색어 "${KEYWORD}"] 이미지 보유 결과 ${items.length}건`);
  items.slice(0, 8).forEach((i) => console.log(`   - "${i.title}" @ ${i.addr1 || '-'} | 지역:${regionMatch(s.address, i.addr1) ? '일치' : '불일치'} | CDN:${i.firstimage ? cdnOf(i.firstimage) : '-'}`));

  // 후보: 지역일치(종로구) + 제목에 북촌한옥마을/북촌. cms/resource 우선.
  const region = items.filter((i) => regionMatch(s.address, i.addr1) && /북촌/.test(i.title));
  const cand = region.find((i) => i.firstimage!.includes('cms/resource/')) ?? region[0];

  let stored: { title: string; url: string } | null = null;
  if (cand) {
    const url = cand.firstimage!.replace(/^http:\/\//, 'https://');
    const ok = await isLoadableImage(url);
    console.log(`\n후보 "${cand.title}" @ ${cand.addr1} 로드검증: ${ok ? 'OK' : 'FAIL'} | CDN:${cdnOf(url)} | 썸네일:${cand.firstimage2 ? 'Y' : 'N'}`);
    if (ok) { await prisma.spot.update({ where: { id: s.id }, data: { coverUrl: url } }); stored = { title: cand.title, url }; }
  }

  console.log('\n=== 결과 ===');
  if (stored) console.log(`✓ 저장: "${stored.title}"\n   ${stored.url}  (CDN:${cdnOf(stored.url)})`);
  else console.log('✗ 유효 후보 없음 — coverUrl null 유지(플레이스홀더)');
  const total = await prisma.spot.count({ where: { coverUrl: { not: null } } });
  console.log(`coverUrl NOT NULL: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
