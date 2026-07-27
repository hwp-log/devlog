import { writeFileSync } from 'fs';
import { join } from 'path';

// 0404: 지역 대표 이미지 풀 생성. KorService2 searchKeyword2(지역명 검색)로 firstimage 수집.
// 런타임 TourAPI 호출 회피용 사전 시드 — 결과는 region-covers.json에 통째로 write(재실행 안전).
// 부품(searchKeyword 재시도 + isLoadableImage 게이트 + http→https)은 backfill-cover-searchkeyword.ts에서 재사용.
// 가로/세로 판별 없음: searchKeyword2 응답에 치수 필드가 없고, 카드 커버는 중앙 크롭이라 세로도 수용.
// firstimage 원격 URL만 저장(Storage 미복사 — 기존 선례 유지). 스크립트 전용, 런타임 호출 아님.

// 지역 키 목록 — 확장 대비 상단 상수(시·도 단위)
const REGIONS = ['서울', '제주도'] as const;

const PER_REGION_MAX = 10; // 지역당 최대 채택(8~10 목표)
const NUM_OF_ROWS = 30; // 후보 여유(로드 실패·중복 컷 감안)

const KEY = process.env.TOUR_API_KEY!;
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

async function main() {
  const regions: Record<string, string[]> = {};

  for (const region of REGIONS) {
    const items = (await searchKeyword(region)).filter((i) => i.firstimage && i.firstimage.trim());
    // http→https 치환 + 중복 URL 제거
    const seen = new Set<string>();
    const urls = items
      .map((i) => i.firstimage!.replace(/^http:\/\//, 'https://'))
      .filter((u) => (seen.has(u) ? false : (seen.add(u), true)));

    const accepted: string[] = [];
    let loadFail = 0;
    for (const u of urls) {
      if (accepted.length >= PER_REGION_MAX) break;
      if (await isLoadableImage(u)) { accepted.push(u); console.log(`  ✓ ${region} ${accepted.length} ${u}`); }
      else { loadFail++; console.log(`  ✗ ${region} 로드 실패 ${u}`); }
      await delay(250);
    }
    regions[region] = accepted;
    console.log(`\n=== ${region}: 채택 ${accepted.length} (후보 ${urls.length}, 로드실패 ${loadFail}) ===\n`);
  }

  const out = {
    _source: {
      api: '한국관광공사 TourAPI KorService2/searchKeyword2',
      url: 'https://api.visitkorea.or.kr',
      note: '지역 대표 이미지 풀. firstimage 원격 URL만 저장(Storage 미복사). 출처 표기 의무 있음 — components/DataAttribution.tsx',
      generatedAt: new Date().toISOString(),
    },
    regions,
  };

  writeFileSync(join(process.cwd(), 'prisma', 'region-covers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('region-covers.json 작성 완료:', Object.fromEntries(REGIONS.map((r) => [r, regions[r].length])));
}

main().catch((e) => { console.error(e); process.exit(1); });
