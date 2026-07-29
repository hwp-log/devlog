// 0424: 시·도(17종) 명칭 사전 단일 소스. 흩어져 있던 네 매핑(spot-addr-prefix.ts ·
// seed-dummy-plans ADDR_PROV · seed-region-covers PROV_FULL/PROV_SHORT · region-cover REGION_ALIAS)을
// 이 사전 + 용도별 조회 함수 3종으로 통합. 행정 개편 시 여기 해당 항목만 고친다.
// key = 지역 풀 키. region-covers.json regions의 키 집합과 동일해야 함.

export type Province = {
  key: string;            // 풀 키 (서울…경남, 제주도)
  formal: string;         // 현행 정식명(신명칭)
  oldFormals: string[];   // 구 정식명 — 데이터·입력에 신·구가 공존하므로 유지
  short: string;          // 약칭 (제주도의 약칭은 '제주')
  extraAliases: string[]; // 자유 입력 전용 기타 별칭 (세종시·제주시)
  // 주소 startsWith 접두. 경상북/남·전라북/남은 '경상'·'전라'로 뭉뚱그리면
  // 남↔북이 섞이므로 접두를 길게 잡는다. 키 간 상호 배타(한 주소는 한 키만 매치).
  addrPrefixes: string[];
};

export const PROVINCES: Province[] = [
  { key: '서울', formal: '서울특별시', oldFormals: [], short: '서울', extraAliases: [], addrPrefixes: ['서울'] },
  { key: '부산', formal: '부산광역시', oldFormals: [], short: '부산', extraAliases: [], addrPrefixes: ['부산'] },
  { key: '대구', formal: '대구광역시', oldFormals: [], short: '대구', extraAliases: [], addrPrefixes: ['대구'] },
  { key: '인천', formal: '인천광역시', oldFormals: [], short: '인천', extraAliases: [], addrPrefixes: ['인천'] },
  { key: '광주', formal: '광주광역시', oldFormals: [], short: '광주', extraAliases: [], addrPrefixes: ['광주'] },
  { key: '대전', formal: '대전광역시', oldFormals: [], short: '대전', extraAliases: [], addrPrefixes: ['대전'] },
  { key: '울산', formal: '울산광역시', oldFormals: [], short: '울산', extraAliases: [], addrPrefixes: ['울산'] },
  { key: '세종', formal: '세종특별자치시', oldFormals: [], short: '세종', extraAliases: ['세종시'], addrPrefixes: ['세종'] },
  { key: '경기', formal: '경기도', oldFormals: [], short: '경기', extraAliases: [], addrPrefixes: ['경기'] },
  { key: '강원', formal: '강원특별자치도', oldFormals: ['강원도'], short: '강원', extraAliases: [], addrPrefixes: ['강원'] },
  { key: '충북', formal: '충청북도', oldFormals: [], short: '충북', extraAliases: [], addrPrefixes: ['충청북'] },
  { key: '충남', formal: '충청남도', oldFormals: [], short: '충남', extraAliases: [], addrPrefixes: ['충청남'] },
  { key: '전북', formal: '전북특별자치도', oldFormals: ['전라북도'], short: '전북', extraAliases: [], addrPrefixes: ['전라북', '전북'] },
  { key: '전남', formal: '전라남도', oldFormals: [], short: '전남', extraAliases: [], addrPrefixes: ['전라남', '전남'] },
  { key: '경북', formal: '경상북도', oldFormals: [], short: '경북', extraAliases: [], addrPrefixes: ['경상북', '경북'] },
  { key: '경남', formal: '경상남도', oldFormals: [], short: '경남', extraAliases: [], addrPrefixes: ['경상남', '경남'] },
  { key: '제주도', formal: '제주특별자치도', oldFormals: ['제주도'], short: '제주', extraAliases: ['제주시'], addrPrefixes: ['제주'] },
];

const byKey = new Map(PROVINCES.map((p) => [p.key, p]));

// 자유 입력 첫 토큰 → 키 (약칭 ∪ 정식명 신·구 ∪ 기타 별칭, exact 매치)
const FREE_TEXT_ALIAS = new Map<string, string>();
for (const p of PROVINCES) {
  for (const name of [p.short, p.formal, ...p.oldFormals, ...p.extraAliases]) {
    FREE_TEXT_ALIAS.set(name, p.key);
  }
}

// 풀 키 여부 (시드가 미지의 키를 조기 차단할 때 사용)
export function isRegionKey(s: string): boolean {
  return byKey.has(s);
}

// 자유 입력(예: "강원도 강릉", "서울특별시 중구…")의 첫 토큰으로 판정.
// 시(市) 단위(예: "경주")는 17 시·도가 아니므로 null.
export function regionKeyFromFreeText(s: string | null | undefined): string | null {
  if (!s) return null;
  const firstToken = s.trim().split(/\s+/)[0];
  return FREE_TEXT_ALIAS.get(firstToken) ?? null;
}

// 주소(예: "전라남도 순천시 …")의 시·도 접두(startsWith)로 판정. 실패 시 null.
export function regionKeyFromAddress(addr: string | null | undefined): string | null {
  const a = addr?.trim();
  if (!a) return null;
  for (const p of PROVINCES) {
    if (p.addrPrefixes.some((prefix) => a.startsWith(prefix))) return p.key;
  }
  return null;
}

// 라벨(예: TourAPI 촬영 위치)에 "포함된" 시·도를 전부 반환(집합, 실패 시 빈 배열).
// 정식명(신·구)이 포함되면 그것만 → "경기도 광주시"는 [경기](광주시=경기 소속 시).
// 정식명이 없는 합성·변형 행정명(예: "전남광주통합특별시")만 약칭 집합으로 → [전남, 광주].
export function regionKeysFromLabel(label: string | null | undefined): string[] {
  const t = label?.trim();
  if (!t) return [];
  const full: string[] = [];
  for (const p of PROVINCES) {
    if ([p.formal, ...p.oldFormals].some((n) => t.includes(n))) full.push(p.key);
  }
  if (full.length) return full;
  return PROVINCES.filter((p) => t.includes(p.short)).map((p) => p.key);
}
