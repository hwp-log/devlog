import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../lib/prisma';

// 0192 경로 C: 커버 없는 스팟을 KorService2 searchKeyword2(이름 검색)로 보완.
// searchKeyword2는 살아있는 cms/resource CDN + firstimage2(썸네일)을 줌 (PhotoGallery cms2/website 사망 이슈 회피).
// 오매칭 방지: grade≥1(제목) + 시군구 지역검증(addr1 vs Spot.address). 저장 전 로드검증(200+image/*) 필수.
// 대상: coverUrl IS NULL AND 시드 45 → 좌표·이름으로 채운 24곳은 IS NULL 필터로 자동 제외. 재실행 안전. DDL 없음.
// 소스 우선순위: 좌표(locationBased) → 이름(searchKeyword2) → PhotoGallery.

const KEY = process.env.TOUR_API_KEY!;
const spotKey = (name: string, lat: number, lng: number) => `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const adminSuffix = /[동읍면리가구시군]$/;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 로드 검증 — 200 + content-type image/* 만 통과 ("저장됨 ≠ 표시됨" 방지)
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
const GRADE_NAME: Record<number, string> = { 3: '완전일치', 2: '이름일치', 1: '핵심토큰' };

const PROV: [string, string][] = [
  ['서울', '서울'], ['부산', '부산'], ['인천', '인천'], ['대구', '대구'], ['대전', '대전'], ['울산', '울산'],
  ['세종', '세종'], ['경기', '경기'], ['강원', '강원'], ['충청북', '충북'], ['충북', '충북'], ['충청남', '충남'],
  ['충남', '충남'], ['전라북', '전북'], ['전북', '전북'], ['전라남', '전남'], ['전남', '전남'],
  ['경상북', '경북'], ['경북', '경북'], ['경상남', '경남'], ['경남', '경남'], ['제주', '제주'], ['광주', '광주'],
];
const prov = (a?: string | null) => { if (!a) return null; for (const [k, v] of PROV) if (a.startsWith(k)) return v; return null; };
const sgg = (a?: string | null) => { if (!a) return null; const t = a.split(/\s+/); for (let i = 1; i < t.length; i++) if (/(시|군|구)$/.test(t[i])) return t[i]; return null; };
const regionMatch = (a?: string | null, b?: string | null) => {
  const pa = prov(a), pb = prov(b), sa = sgg(a), sb = sgg(b);
  return !!(pa && pb && pa === pb && sa && sb && sa === sb);
};

type KwItem = { title: string; addr1?: string; firstimage?: string; firstimage2?: string };
async function searchKeyword(keyword: string): Promise<KwItem[]> {
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'dotrip', _type: 'json', numOfRows: '20', pageNo: '1', arrange: 'A', keyword });
  const url = `https://apis.data.go.kr/B551011/KorService2/searchKeyword2?${qs}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    const text = await res.text();
    let j: unknown;
    try { j = JSON.parse(text); } catch { await delay(300); continue; }
    // @ts-expect-error 동적 JSON
    let items = j?.response?.body?.items?.item;
    if (items && !Array.isArray(items)) items = [items];
    return (items as KwItem[]) || [];
  }
  return [];
}

async function main() {
  const seed = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'seed-spots.json'), 'utf8')) as {
    spots: { name: string; lat: number; lng: number }[];
  };
  const seedKeys = new Set(seed.spots.map((s) => spotKey(s.name, s.lat, s.lng)));
  const candidates = await prisma.spot.findMany({ where: { coverUrl: null }, select: { id: true, name: true, address: true, lat: true, lng: true } });
  const targets = candidates.filter((s) => seedKeys.has(spotKey(s.name, s.lat, s.lng)));
  console.log(`coverUrl IS NULL ${candidates.length}개 중 시드 대상 ${targets.length}개\n`);

  const accepted: { name: string; grade: string; title: string; addr: string }[] = [];
  const rejected: Record<string, number> = {};
  const updatedIds: string[] = [];

  for (const s of targets) {
    const items = (await searchKeyword(s.name)).filter((i) => i.firstimage && i.firstimage.trim());
    const named = items.filter((i) => grade(s.name, i.title) >= 1);
    const hit = named.find((i) => regionMatch(s.address, i.addr1));
    if (!hit) {
      const reason = !items.length ? '검색/이미지 0' : !named.length ? '이름 불일치' : named.find((i) => i.addr1) ? '지역 불일치' : '지역정보 없음';
      rejected[reason] = (rejected[reason] || 0) + 1;
      console.log(`  ✗ ${s.name} skip (${reason})`);
      await delay(250);
      continue;
    }
    const coverUrl = hit.firstimage!.replace(/^http:\/\//, 'https://');
    if (!(await isLoadableImage(coverUrl))) {
      rejected['로드 실패'] = (rejected['로드 실패'] || 0) + 1;
      console.log(`  ✗ ${s.name} skip (로드 실패)`);
      await delay(250);
      continue;
    }
    await prisma.spot.update({ where: { id: s.id }, data: { coverUrl } });
    updatedIds.push(s.id);
    const g = GRADE_NAME[grade(s.name, hit.title)];
    accepted.push({ name: s.name, grade: g, title: hit.title, addr: hit.addr1 ?? '' });
    console.log(`  ✓ ${s.name} → [${g}] "${hit.title}" @ ${hit.addr1}`);
    await delay(250);
  }

  console.log(`\n=== 채택 ${accepted.length}/${targets.length} ===`);
  accepted.forEach((a) => console.log(`  ✓ ${a.name.padEnd(18)} [${a.grade}] "${a.title}" @ ${a.addr}`));
  console.log(`\n=== 거부 (사유별) ===\n  `, JSON.stringify(rejected));
  console.log(`\n갱신 spot id(되돌림용): ${JSON.stringify(updatedIds)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
