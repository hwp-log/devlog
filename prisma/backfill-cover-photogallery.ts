import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../lib/prisma';

// 0192 보완 백필(경로 B): 좌표 기반(KorService2)에서 못 채운 스팟을 PhotoGalleryService1 "이름 검색"으로 보완.
// 오매칭 방지: grade≥1(제목 관련성) + 시군구 지역검증(galPhotographyLocation vs Spot.address) 둘 다 통과만 채택.
// 지역검증 실증: 약천사(경기 파주) vs "동해 약천사"(강원 동해) 같은 동명이소를 거른다.
// 대상: coverUrl IS NULL AND 시드 45 → 좌표로 채운 18곳은 IS NULL 필터로 자동 제외(무접촉). 재실행 안전.
// DDL 없음(기존 coverUrl 재사용). galWebImageUrl은 http로 오므로 https 치환 후 저장.

const KEY = process.env.TOUR_API_KEY!;
const spotKey = (name: string, lat: number, lng: number) => `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const adminSuffix = /[동읍면리가구시군]$/;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 로드 검증 게이트 — 실제 200 + content-type: image/* 인 URL만 통과 ("저장됨 ≠ 표시됨" 방지).
// PhotoGallery cms2/website 트리처럼 죽은 URL(404 text/html)을 저장 전에 차단. 경로 패턴이 아닌 HTTP 실검증.
async function isLoadableImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
    const ct = res.headers.get('content-type') || '';
    await res.arrayBuffer(); // 본문 소비로 커넥션 정리
    return res.status === 200 && ct.startsWith('image/');
  } catch {
    return false;
  }
}

// 등급: 3 완전, 2 이름(포함), 1 핵심토큰, 0 광역(거부), -1 무매칭 (좌표 백필과 동일 기준)
function grade(name: string, title: string): number {
  const nN = norm(name), nT = norm(title), tok = norm(name.split(/\s+/)[0]);
  if (nT === nN) return 3;
  if (nT.includes(nN)) return 2;
  if (nN.includes(nT) && nT.length >= 2 && nT !== tok) return 2;
  if (nT.includes(tok)) {
    if (nT === tok && adminSuffix.test(name.split(/\s+/)[0])) return 0;
    return 1;
  }
  return -1;
}
const GRADE_NAME: Record<number, string> = { 3: '완전일치', 2: '이름일치', 1: '핵심토큰' };

// 시군구 지역검증 — 시도(정규화) + 시군구 토큰 둘 다 일치해야 같은 지역
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

type GalItem = { galTitle: string; galWebImageUrl?: string; galPhotographyLocation?: string };
async function gallery(keyword: string): Promise<GalItem[]> {
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'dotrip', _type: 'json', numOfRows: '20', pageNo: '1', arrange: 'A', keyword });
  const url = `https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1?${qs}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    const text = await res.text();
    let j: unknown;
    try { j = JSON.parse(text); } catch { await delay(300); continue; }
    // @ts-expect-error 동적 JSON
    let items = j?.response?.body?.items?.item;
    if (items && !Array.isArray(items)) items = [items];
    return (items as GalItem[]) || [];
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
  console.log(`coverUrl IS NULL ${candidates.length}개 중 시드 대상 ${targets.length}개 (좌표로 채운 18곳 자동 제외)\n`);

  const accepted: { name: string; grade: string; title: string; loc: string }[] = [];
  const rejected: { name: string; reason: string }[] = [];
  const updatedIds: string[] = [];

  for (const s of targets) {
    const items = (await gallery(s.name)).filter((i) => i.galWebImageUrl && i.galWebImageUrl.trim());
    if (!items.length) { rejected.push({ name: s.name, reason: '검색결과/이미지 0' }); console.log(`  ✗ ${s.name} skip (검색 0)`); await delay(250); continue; }
    const named = items.filter((i) => grade(s.name, i.galTitle) >= 1);
    const hit = named.find((i) => regionMatch(s.address, i.galPhotographyLocation));
    if (!hit) {
      const wrongRegion = named.find((i) => i.galPhotographyLocation);
      const reason = !named.length ? '이름 불일치(제목 무관)' : wrongRegion ? '지역 불일치' : '지역정보 없음';
      rejected.push({ name: s.name, reason });
      console.log(`  ✗ ${s.name} skip (${reason})`);
      await delay(250);
      continue;
    }
    const coverUrl = hit.galWebImageUrl!.replace(/^http:\/\//, 'https://');
    // 로드 검증 게이트: 실제 표시 가능한 이미지만 저장 (PhotoGallery는 죽은 cms2/website URL이 섞임)
    if (!(await isLoadableImage(coverUrl))) {
      rejected.push({ name: s.name, reason: '이미지 로드 실패(404 등)' });
      console.log(`  ✗ ${s.name} skip (이미지 로드 실패)`);
      await delay(250);
      continue;
    }
    await prisma.spot.update({ where: { id: s.id }, data: { coverUrl } });
    updatedIds.push(s.id);
    const g = GRADE_NAME[grade(s.name, hit.galTitle)];
    accepted.push({ name: s.name, grade: g, title: hit.galTitle, loc: hit.galPhotographyLocation ?? '' });
    console.log(`  ✓ ${s.name} → [${g}] "${hit.galTitle}" @ ${hit.galPhotographyLocation}`);
    await delay(250);
  }

  console.log(`\n=== 채택 ${accepted.length}/${targets.length} ===`);
  accepted.forEach((a) => console.log(`  ✓ ${a.name.padEnd(18)} [${a.grade}] "${a.title}" @ ${a.loc}`));
  const byReason: Record<string, number> = {};
  rejected.forEach((r) => { byReason[r.reason] = (byReason[r.reason] || 0) + 1; });
  console.log(`\n=== 거부 ${rejected.length} (사유별) ===`);
  console.log('  ', JSON.stringify(byReason));
  console.log(`\n갱신 spot id(되돌림용): ${JSON.stringify(updatedIds)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
