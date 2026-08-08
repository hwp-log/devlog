// 이 유니온은 prisma/schema.prisma의 `enum CostCategory` 수기 복제다 — 자동 파생이 아니라
// 한쪽만 고치면 조용히 어긋난다(빌드는 통과하고 런타임에 갈림). enum을 고칠 땐 반드시
// 이 줄과 아래 CATEGORIES·CATEGORY_LABEL, 그리고 색 맵 CATEGORY_BAR 2곳
// (my-plan/_components/CostSection.tsx · story/[id]/PublicCostSection.tsx)과
// 색 토큰(lib/theme.ts cat-* 라이트·다크 + app/globals.css 이름 매핑)까지 같이 본다.
export type CostCategory =
  | 'TRANSPORT'
  | 'PARKING'
  | 'ACCOMMODATION'
  | 'FOOD'
  | 'ENTRANCE'
  | 'ETC';

// 이 배열 순서가 정본 — 폼 select 옵션(MyPlanNewForm 2곳)·소유자 뷰 카테고리 줄(CostSection)·
// 요약 계산 순회(summarize-plan-cost)가 전부 여기서 나온다.
// (읽기 뷰 누적 막대는 비중 내림차순 정렬이라 이 순서와 무관.)
// 0564: PARKING은 TRANSPORT 다음 — 사용자가 훑는 건 select·카테고리 줄이고,
//   "이동에 드는 돈"끼리 인접해야 스캔 비용이 낮다. ETC는 관례대로 맨 뒤.
export const CATEGORIES: CostCategory[] = [
  'TRANSPORT',
  'PARKING',
  'ACCOMMODATION',
  'FOOD',
  'ENTRANCE',
  'ETC',
];

export const CATEGORY_LABEL: Record<CostCategory, string> = {
  TRANSPORT: '교통',
  PARKING: '주차비',
  ACCOMMODATION: '숙박',
  FOOD: '식비',
  ENTRANCE: '입장료',
  ETC: '기타',
};

const CURRENCY_SYMBOL: Record<'KRW' | 'USD' | 'JPY', string> = {
  KRW: '₩',
  USD: '$',
  JPY: '¥',
};

export function formatAmount(
  amount: number,
  currency: 'KRW' | 'USD' | 'JPY',
): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString()}`;
}
