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
  // 제주시·서귀포시는 기초자치단체가 아닌 행정시(법인격 없음)지만, 공개 플랜 region이
  // "제주도 서귀포시" 형태라 자유 입력 첫 토큰으로 올 수 있어 별칭에 포함(제주시와 대칭).
  { key: '제주도', formal: '제주특별자치도', oldFormals: ['제주도'], short: '제주', extraAliases: ['제주시', '서귀포시', '서귀포'], addrPrefixes: ['제주'] },
];

const byKey = new Map(PROVINCES.map((p) => [p.key, p]));

// 자유 입력 첫 토큰 → 키 (약칭 ∪ 정식명 신·구 ∪ 기타 별칭, exact 매치)
const FREE_TEXT_ALIAS = new Map<string, string>();
for (const p of PROVINCES) {
  for (const name of [p.short, p.formal, ...p.oldFormals, ...p.extraAliases]) {
    FREE_TEXT_ALIAS.set(name, p.key);
  }
}

// 0432: 기초자치단체(시·군·자치구) 전수 → 소속 시·도 키.
// 시·도 '별칭'(extraAliases: 같은 시·도의 다른 표기)과 성격이 다르다 —
// 이건 '하위 지역'이므로 별도 맵으로 둔다. 풀은 여전히 시·도 17개뿐이라,
// 이 맵의 역할은 "region 첫 토큰이 시·군구여도 회색 카드가 안 뜬다"까지다.
// (도시별 커버 풀은 만들지 않는다.)
// 소스는 정식 명칭(접미 포함). base(접미 제거)는 파생 등록 — 존재하지 않는
// 조합('경주군' 등)이 들어가지 않게 무차별 생성하지 않는다.
// 세종·제주도는 기초자치단체가 없는 단층제 → 빈 배열.
// (제주 행정시 제주시/서귀포시는 법인격 없는 행정시라 여기 넣지 않음.
//  제주시는 시·도 사전 extraAliases에 이미 있음.)
const MUNICIPALITIES: Record<string, string[]> = {
  서울: ['종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구'],
  부산: ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
  대구: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'], // 군위군: 2023.7 경북→대구 편입
  인천: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'], // 남구→미추홀구 개칭(2018), 남동구는 별개
  광주: ['동구', '서구', '남구', '북구', '광산구'],
  대전: ['동구', '중구', '서구', '유성구', '대덕구'],
  울산: ['중구', '남구', '동구', '북구', '울주군'],
  세종: [],
  경기: ['수원시', '성남시', '의정부시', '안양시', '부천시', '광명시', '평택시', '동두천시', '안산시', '고양시', '과천시', '구리시', '남양주시', '오산시', '시흥시', '군포시', '의왕시', '하남시', '용인시', '파주시', '이천시', '안성시', '김포시', '화성시', '광주시', '양주시', '포천시', '여주시', '연천군', '가평군', '양평군'], // 광주시 등록, base '광주'는 광주광역시(사전)와 충돌 → 파생 안 함(BASE_SKIP)
  강원: ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군'], // 고성군: 강원·경남 공유 → 강원에 배정(임의 선택, 어느 쪽이든 회색 방지는 달성)
  충북: ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
  충남: ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군'],
  전북: ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군'],
  전남: ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군'],
  경북: ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군'], // 군위군은 대구로 편입 → 여기 없음
  경남: ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군', '창녕군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군'], // 고성군은 강원에 배정 → 경남 미등록(동음이의)
  제주도: [],
};

// 전국에서 여러 광역시가 공유하는 자치구 이름 — 단일 토큰으로 시·도 구분 불가(반드시 오배정).
// region 문자열은 대개 "부산광역시 중구…"처럼 광역시명이 첫 토큰이라 시·도 사전(①)이 해결한다.
// 강서구(서울·부산), 남구·북구(4~5개 광역시)까지 포함해 전면 제외.
const AMBIGUOUS_DISTRICTS = new Set(['중구', '동구', '서구', '남구', '북구', '강서구']);
// base(접미 제거)를 파생하지 않을 이름 — 시·도 사전과 충돌.
const BASE_SKIP = new Set(['광주']); // 경기 '광주시'의 base. '광주'는 광주광역시(사전)로 확정.

// 시·군·구 → 시·도 키. 접미 포함 정식명 + base(접미 1자 제거)를 함께 등록.
const CITY_TO_PROVINCE = new Map<string, string>();
for (const [key, cities] of Object.entries(MUNICIPALITIES)) {
  for (const full of cities) {
    if (AMBIGUOUS_DISTRICTS.has(full)) continue;
    CITY_TO_PROVINCE.set(full, key);
    const base = full.replace(/[시군구]$/, '');
    if (base !== full && !BASE_SKIP.has(base)) CITY_TO_PROVINCE.set(base, key);
  }
}

// 풀 키 여부 (시드가 미지의 키를 조기 차단할 때 사용)
export function isRegionKey(s: string): boolean {
  return byKey.has(s);
}

// 자유 입력(예: "강원도 강릉", "서울특별시 중구…", "경주")의 첫 토큰으로 판정.
// 판정 순서: ① 시·도 사전(약칭·정식명·별칭) → ② 시·군·구 매핑(0432) → ③ null.
// 시·군구 이름(예: "경주")도 소속 시·도로 올라간다(회색 카드 방지). 풀은 시·도 단위.
export function regionKeyFromFreeText(s: string | null | undefined): string | null {
  if (!s) return null;
  const firstToken = s.trim().split(/\s+/)[0];
  return FREE_TEXT_ALIAS.get(firstToken) ?? CITY_TO_PROVINCE.get(firstToken) ?? null;
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
