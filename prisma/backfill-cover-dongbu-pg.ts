import { prisma } from '../lib/prisma';

// 0192 재시도(단일, PhotoGallery 경로): 동부마을 = 창원 북부리 팽나무(우영우 소덕동 팽나무).
// KorService2 POI엔 없으나 PhotoGallery 사진 DB엔 있음(두 DB가 다름). 사람 지정 검색어 "우영우 팽나무".
// 지역검증(경남 창원) + 로드검증(200+image/*, 필수 — cms2/website는 죽었을 수 있음) 통과 시 저장(https 치환).

const KEY = process.env.TOUR_API_KEY!;
const KEYWORD = '우영우 팽나무';
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
type GalItem = { galTitle: string; galWebImageUrl?: string; galPhotographyLocation?: string };
async function gallery(keyword: string): Promise<GalItem[]> {
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'dotrip', _type: 'json', numOfRows: '20', pageNo: '1', arrange: 'A', keyword });
  for (let a = 0; a < 3; a++) {
    const res = await fetch(`https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1?${qs}`);
    const text = await res.text(); let j: unknown;
    try { j = JSON.parse(text); } catch { await delay(300); continue; }
    // @ts-expect-error 동적
    let items = j?.response?.body?.items?.item; if (items && !Array.isArray(items)) items = [items];
    return (items as GalItem[]) || [];
  }
  return [];
}

async function main() {
  const s = await prisma.spot.findFirst({ where: { name: '동부마을' }, select: { id: true, coverUrl: true, address: true } });
  if (!s) { console.log('동부마을 없음'); return; }
  console.log(`동부마을 (주소: ${s.address}) — 현재 coverUrl: ${s.coverUrl ?? 'null'}\n`);
  if (s.coverUrl) { console.log('이미 커버 있음 → 종료(무접촉)'); return; }

  const items = (await gallery(KEYWORD)).filter((i) => i.galWebImageUrl && i.galWebImageUrl.trim());
  console.log(`[검색어 "${KEYWORD}"] 이미지 보유 결과 ${items.length}건`);
  items.forEach((i) => console.log(`   - "${i.galTitle}" @ ${i.galPhotographyLocation || '-'} | 지역:${regionMatch(s.address, i.galPhotographyLocation) ? '일치' : '불일치'} | CDN:${cdnOf(i.galWebImageUrl!)}`));

  const cand = items.find((i) => regionMatch(s.address, i.galPhotographyLocation));

  let stored: { title: string; url: string; cdn: string } | null = null;
  if (cand) {
    const url = cand.galWebImageUrl!.replace(/^http:\/\//, 'https://');
    const cdn = cdnOf(url);
    const ok = await isLoadableImage(url);
    console.log(`\n후보 "${cand.galTitle}" @ ${cand.galPhotographyLocation}\n  CDN:${cdn}${cdn.includes('cms2/website') ? ' (⚠️ at-risk)' : ''} | 로드검증:${ok ? 'OK' : 'FAIL'}`);
    if (ok) { await prisma.spot.update({ where: { id: s.id }, data: { coverUrl: url } }); stored = { title: cand.galTitle, url, cdn }; }
  }

  console.log('\n=== 결과 ===');
  if (stored) console.log(`✓ 저장: "${stored.title}"\n   ${stored.url}  (CDN:${stored.cdn}${stored.cdn.includes('cms2/website') ? ' — at-risk, 향후 revert-dead-covers 재검증 대상' : ''})`);
  else console.log('✗ 유효 후보 없음(지역 불일치 또는 로드 실패) — coverUrl null 유지(플레이스홀더)');
  const total = await prisma.spot.count({ where: { coverUrl: { not: null } } });
  console.log(`coverUrl NOT NULL: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
