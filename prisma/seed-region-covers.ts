import { writeFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../lib/prisma';

// 0409: 지역 대표 이미지 풀 = 자체 Spot 촬영지 커버(우선) + 한국관광공사 보충.
// Spot 커버가 1장이라도 있으면 그 지역은 Spot만 사용(관광공사 보충 안 함) — 무관 POI 혼입 방지.
// 보충(searchKeyword2)은 Spot 0장 지역에만 적용. Spot 커버는 검증된 URL이라 isLoadableImage 생략,
// 보충분에만 게이트 적용. 결과는 region-covers.json에 통째로 write(재실행 안전). 스크립트 전용.
// (0404 원본: 관광공사 단독 → 지역 무작위 POI가 코스와 무관한 사진을 줌. 0409에서 Spot 우선으로 교체.)

// 지역 키 목록 — 전 시·도(17종). region-cover.ts REGION_ALIAS의 값 집합과 동일해야 함.
const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주도',
] as const;

// 풀 키 → Spot.address 시·도 접두(startsWith 매칭). 신·구 명칭 공존 지역(전북특별자치도/전라북도 등)은 둘 다 나열.
// 경상북/남·전라북/남은 '경상'·'전라'로 뭉뚱그리면 남↔북이 섞이므로 접두를 길게 잡는다.
const SPOT_ADDR_PREFIX: Record<string, string[]> = {
  서울: ['서울'],
  부산: ['부산'],
  대구: ['대구'],
  인천: ['인천'],
  광주: ['광주'],
  대전: ['대전'],
  울산: ['울산'],
  세종: ['세종'],
  경기: ['경기'],
  강원: ['강원'],
  충북: ['충청북'],
  충남: ['충청남'],
  전북: ['전라북', '전북'],
  전남: ['전라남', '전남'],
  경북: ['경상북', '경북'],
  경남: ['경상남', '경남'],
  제주도: ['제주'],
};

const PER_REGION_MAX = 10; // 관광공사 보충(Spot 0장 지역) 시 최대 채택
const NUM_OF_ROWS = 30; // 후보 여유(로드 실패·중복 컷 감안)

const KEY = process.env.TOUR_API_KEY!;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 로드 검증 — 200 + content-type image/* 만 통과 ("저장됨 ≠ 표시됨" 방지). 보충분에만 적용.
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
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'dotrip', _type: 'json', numOfRows: String(NUM_OF_ROWS), pageNo: '1', arrange: 'A', keyword });
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

// 지역의 Spot 커버 URL 수집(중복 제거). address가 해당 시·도 접두로 시작하는 coverUrl NOT NULL 행.
async function spotCoversFor(region: string): Promise<string[]> {
  const prefixes = SPOT_ADDR_PREFIX[region] ?? [];
  if (!prefixes.length) return [];
  const rows = await prisma.spot.findMany({
    where: { coverUrl: { not: null } },
    select: { address: true, coverUrl: true },
  });
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const r of rows) {
    const a = r.address?.trim();
    if (!a || !prefixes.some((p) => a.startsWith(p))) continue;
    const u = r.coverUrl!;
    if (seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
  }
  return urls;
}

async function main() {
  const regions: Record<string, string[]> = {};
  const stats: Record<string, { spot: number; api: number }> = {};

  for (const region of REGIONS) {
    const spotUrls = await spotCoversFor(region);

    if (spotUrls.length > 0) {
      // Spot 커버가 있으면 그대로 사용(보충 없음) — 무관 POI 혼입 방지
      regions[region] = spotUrls;
      stats[region] = { spot: spotUrls.length, api: 0 };
      console.log(`\n=== ${region}: Spot ${spotUrls.length} (관광공사 보충 안 함) ===\n`);
      continue;
    }

    // Spot 0장 → 관광공사 searchKeyword2로 보충(게이트 적용)
    const items = (await searchKeyword(region)).filter((i) => i.firstimage && i.firstimage.trim());
    const seen = new Set<string>();
    const candidates = items
      .map((i) => i.firstimage!.replace(/^http:\/\//, 'https://'))
      .filter((u) => (seen.has(u) ? false : (seen.add(u), true)));

    const accepted: string[] = [];
    let loadFail = 0;
    for (const u of candidates) {
      if (accepted.length >= PER_REGION_MAX) break;
      if (await isLoadableImage(u)) { accepted.push(u); console.log(`  ✓ ${region} ${accepted.length} ${u}`); }
      else { loadFail++; console.log(`  ✗ ${region} 로드 실패 ${u}`); }
      await delay(250);
    }
    regions[region] = accepted;
    stats[region] = { spot: 0, api: accepted.length };
    console.log(`\n=== ${region}: Spot 0 → 관광공사 보충 ${accepted.length} (후보 ${candidates.length}, 로드실패 ${loadFail}) ===\n`);
  }

  const out = {
    _source: {
      api: '자체 Spot 촬영지 커버(우선) + 한국관광공사 TourAPI KorService2/searchKeyword2(보충)',
      url: 'https://api.visitkorea.or.kr',
      note: '지역 대표 이미지 풀. Spot 커버(촬영지 검증됨)를 우선 사용하고, Spot 커버가 1장이라도 있는 지역은 관광공사 보충을 하지 않는다(무관 POI 혼입 방지 — 10장은 목표치지 정원이 아님). 보충은 Spot 0장 지역에만 적용하며 그 경우만 로드검증(200+image/*)을 태운다. firstimage 원격 URL만 저장(Storage 미복사). 출처 표기 의무 — components/DataAttribution.tsx',
      generatedAt: new Date().toISOString(),
    },
    regions,
  };

  writeFileSync(join(process.cwd(), 'prisma', 'region-covers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('region-covers.json 작성 완료:',
    Object.fromEntries(REGIONS.map((r) => [r, `${regions[r].length}장 (Spot ${stats[r].spot} / 관광공사 ${stats[r].api})`])));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
