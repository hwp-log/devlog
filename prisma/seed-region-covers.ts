import { writeFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../lib/prisma';
import { SPOT_ADDR_PREFIX, addressMatchesRegionKey } from '../lib/plan/spot-addr-prefix';

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

const PER_REGION_MAX = 10; // 지역당 목표 장수
const SPOT_MIN = 3;        // 0419: Spot 커버가 이 수 미만이면 갤러리로 보충(목표 10까지). 이상이면 Spot만 사용.
const NUM_OF_ROWS = 30;    // 갤러리 페이지당 요청 수(후보 여유 — dedup·지역불일치·로드실패 컷 감안)
const MAX_PAGES = 5;       // 목표 미달 시 pageNo 최대 확장

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

// 갤러리(PhotoGalleryService1) 한 페이지 조회. arrange는 호출부가 지정(B∪C 합집합 수집).
type GalItem = { galTitle?: string; galWebImageUrl?: string; galPhotographyLocation?: string };
async function gallery(keyword: string, pageNo: number, arrange: string): Promise<GalItem[]> {
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'dotrip', _type: 'json', numOfRows: String(NUM_OF_ROWS), pageNo: String(pageNo), arrange, keyword });
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

// galPhotographyLocation → 풀 키 "집합". startsWith가 아니라 문자열에 포함된 시·도 명칭으로 판정한다.
// 정식명(경기도·충청북도·전라남도…)이 포함되면 그것만 채택 → "경기도 광주시"는 {경기}(광주시=경기 소속 시).
// 정식명이 없는 합성·변형 행정명(예: "전남광주통합특별시" — 광주·전남 사진 공용 라벨)만 약칭 집합으로 →
// {전남, 광주} 둘 다 반환하고, 어느 지역 풀에 넣을지는 "검색 키워드"가 결정한다.
// (TourAPI가 광주·전남을 한 라벨로 묶어 위치만으론 구분 불가 — 단일 지역으로 강제하면 반대쪽이 0장 됨.)
// 합성·변형명이 또 나와도 같은 규칙(정식명 우선 → 없으면 약칭 집합)으로 처리된다.
const PROV_FULL: [string, string][] = [
  ['서울특별시', '서울'], ['부산광역시', '부산'], ['대구광역시', '대구'], ['인천광역시', '인천'],
  ['광주광역시', '광주'], ['대전광역시', '대전'], ['울산광역시', '울산'], ['세종특별자치시', '세종'],
  ['경기도', '경기'], ['강원특별자치도', '강원'], ['강원도', '강원'], ['충청북도', '충북'], ['충청남도', '충남'],
  ['전북특별자치도', '전북'], ['전라북도', '전북'], ['전라남도', '전남'], ['경상북도', '경북'], ['경상남도', '경남'],
  ['제주특별자치도', '제주도'], ['제주도', '제주도'],
];
const PROV_SHORT: [string, string][] = [
  ['서울', '서울'], ['부산', '부산'], ['대구', '대구'], ['인천', '인천'], ['광주', '광주'], ['대전', '대전'],
  ['울산', '울산'], ['세종', '세종'], ['경기', '경기'], ['강원', '강원'], ['충북', '충북'], ['충남', '충남'],
  ['전북', '전북'], ['전남', '전남'], ['경북', '경북'], ['경남', '경남'], ['제주', '제주도'],
];
function locProvKeys(loc?: string): Set<string> {
  const s = new Set<string>();
  const t = loc?.trim();
  if (!t) return s;
  for (const [n, k] of PROV_FULL) if (t.includes(n)) s.add(k);
  if (s.size) return s;                                  // 정식명이 있으면 그것만
  for (const [n, k] of PROV_SHORT) if (t.includes(n)) s.add(k); // 없으면 약칭 집합(합성명)
  return s;
}

// 갤러리 보충 수집(누적형): keyword로 arrange B∪C를 pageNo 1..MAX_PAGES 순회, galTitle 장소별 1장 dedup,
// locProvKey(위치)가 verifyRegion과 일치할 때만, http→https, 로드검증 통과분만. accepted가 need개 될 때까지.
// verifyRegion(판정 대상)과 keyword(검색어)를 분리 — 정식명 재시도(충북→충청북도) 시 keyword만 바꾼다.
async function collectGallery(
  keyword: string, verifyRegion: string, need: number,
  usedTitles: Set<string>, usedUrls: Set<string>, accepted: string[],
): Promise<void> {
  let scanned = 0, loadFail = 0, wrongRegion = 0, noLoc = 0, dup = 0;
  for (let page = 1; page <= MAX_PAGES && accepted.length < need; page++) {
    const items = [...await gallery(keyword, page, 'B'), ...await gallery(keyword, page, 'C')];
    if (!items.length) break;
    for (const it of items) {
      if (accepted.length >= need) break;
      scanned++;
      const title = it.galTitle?.trim();
      const raw = it.galWebImageUrl?.trim();
      if (!title || !raw) continue;
      if (usedTitles.has(title)) { dup++; continue; }          // 같은 장소 1장만
      const keys = locProvKeys(it.galPhotographyLocation);
      if (!keys.has(verifyRegion)) { keys.size ? wrongRegion++ : noLoc++; continue; } // 지역 검증(집합 포함 여부)
      const url = raw.replace(/^http:\/\//, 'https://');
      if (usedUrls.has(url)) { dup++; continue; }
      if (!(await isLoadableImage(url))) { loadFail++; await delay(250); continue; }
      usedTitles.add(title); usedUrls.add(url); accepted.push(url);
      console.log(`  ✓ ${verifyRegion}<${keyword}> ${accepted.length} [${title}] ${url}`);
      await delay(250);
    }
  }
  console.log(`  (${verifyRegion}<${keyword}> 스캔 ${scanned} · 로드실패 ${loadFail} · 지역불일치 ${wrongRegion} · 위치없음 ${noLoc} · 중복 ${dup})`);
}

// (C) 목표 미달 시 약칭 대신 정식 명칭으로 재시도(예: 충북 → 충청북도)
const FORMAL_NAME: Record<string, string> = {
  서울: '서울특별시', 부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시', 광주: '광주광역시',
  대전: '대전광역시', 울산: '울산광역시', 세종: '세종특별자치시', 경기: '경기도', 강원: '강원특별자치도',
  충북: '충청북도', 충남: '충청남도', 전북: '전북특별자치도', 전남: '전라남도', 경북: '경상북도',
  경남: '경상남도', 제주도: '제주특별자치도',
};

// 지역의 Spot 커버 URL 수집(중복 제거). address가 해당 시·도 접두로 시작하는 coverUrl NOT NULL 행.
async function spotCoversFor(region: string): Promise<string[]> {
  if (!(SPOT_ADDR_PREFIX[region] ?? []).length) return [];
  const rows = await prisma.spot.findMany({
    where: { coverUrl: { not: null } },
    select: { address: true, coverUrl: true },
  });
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const r of rows) {
    if (!addressMatchesRegionKey(r.address, region)) continue;
    const u = r.coverUrl!;
    if (seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
  }
  return urls;
}

async function main() {
  const regions: Record<string, string[]> = {};
  const stats: Record<string, { spot: number; gallery: number }> = {};

  for (const region of REGIONS) {
    const spotUrls = await spotCoversFor(region);

    if (spotUrls.length >= SPOT_MIN) {
      // Spot 커버 충분(>=3) → 그대로 사용, 갤러리 보충 안 함
      regions[region] = spotUrls;
      stats[region] = { spot: spotUrls.length, gallery: 0 };
      console.log(`\n=== ${region}: Spot ${spotUrls.length} (>=${SPOT_MIN}, 갤러리 보충 안 함) ===\n`);
      continue;
    }

    // Spot < 3 → Spot 커버를 앞에 두고 뒤를 갤러리로 채워 목표 10장(0419)
    const need = PER_REGION_MAX - spotUrls.length;
    const usedTitles = new Set<string>();
    const usedUrls = new Set<string>(spotUrls);
    const galleryUrls: string[] = [];
    await collectGallery(region, region, need, usedTitles, usedUrls, galleryUrls); // 1차: 약칭 키워드
    // (C) 여전히 10 미달이면 정식 명칭으로 한 번 더(누적)
    if (spotUrls.length + galleryUrls.length < PER_REGION_MAX) {
      const formal = FORMAL_NAME[region];
      if (formal && formal !== region) {
        await collectGallery(formal, region, need, usedTitles, usedUrls, galleryUrls);
      }
    }
    regions[region] = [...spotUrls, ...galleryUrls];
    stats[region] = { spot: spotUrls.length, gallery: galleryUrls.length };
    console.log(`\n=== ${region}: Spot ${spotUrls.length} + 갤러리 ${galleryUrls.length} = ${regions[region].length} ===\n`);
  }

  const out = {
    _source: {
      api: '자체 Spot 촬영지 커버(우선) + 한국관광공사 TourAPI PhotoGalleryService1/gallerySearchList1(보충)',
      url: 'https://api.visitkorea.or.kr',
      note: '지역 대표 이미지 풀. Spot 커버(촬영지 검증됨)를 앞에 우선 배치한다. 0419: 보충 소스를 KorService2/searchKeyword2 → PhotoGalleryService1/gallerySearchList1(홍보 큐레이션 사진)로 교체. 보충 규칙도 변경 — 기존 "Spot 1장이라도 있으면 보충 안 함"(0409, 관광공사 무관 POI 혼입 우려)에서 "Spot 3장 미만이면 갤러리로 목표 10장까지 보충"으로. 근거: 갤러리는 대표 랜드마크 큐레이션이라 무관 POI 위험이 사라졌고, Spot 1~2장뿐인 지역(대구·충남·경남 등)은 같은 사진 반복을 피해야 한다. 갤러리 수집: arrange를 B(조회순=인기)와 C(수정일순=최신) 두 번 호출해 galTitle 기준 합집합(지역마다 다양성 승자가 뒤집혀 합집합이 안전), 장소별 1장 dedup, pageNo 최대 5까지 확장, galWebImageUrl http→https, 로드검증(200+image/*) 통과분만. 지역 판정(galPhotographyLocation→시·도)은 startsWith가 아니라 "포함된 시·도 명칭 집합"으로 — 정식명(경기도·전라남도…)이 있으면 그것만(경기도 광주시→경기), 정식명 없는 합성명("전남광주통합특별시" = 광주·전남 공용 라벨, TourAPI가 둘을 한 라벨로 묶어 위치만으론 구분 불가)만 약칭 집합{전남,광주}으로 반환하고 검색 키워드가 최종 결정. startsWith 오분류 및 단일 강제 시 반대쪽 0장 문제를 규칙 자체로 해결. 그래도 10 미달인 지역은 약칭 대신 정식명(충북→충청북도)으로 한 번 더 시도, 여전히 미달이면 있는 만큼. 원격 URL만 저장(Storage 미복사). 출처 표기 의무 — components/DataAttribution.tsx',
      generatedAt: new Date().toISOString(),
    },
    regions,
  };

  writeFileSync(join(process.cwd(), 'prisma', 'region-covers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('region-covers.json 작성 완료:',
    Object.fromEntries(REGIONS.map((r) => [r, `${regions[r].length}장 (Spot ${stats[r].spot} / 갤러리 ${stats[r].gallery})`])));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
