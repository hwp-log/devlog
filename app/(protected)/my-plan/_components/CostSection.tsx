import {
  CATEGORIES,
  CATEGORY_LABEL,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';

interface Props {
  totals: Record<CostCategory, number>;
  flightAmount: number;
  total: number;
  currency: 'KRW' | 'USD' | 'JPY';
}

// 0527: 카테고리 색 = 이름 왼쪽 3px 막대(아이콘·진행 막대 대체). 색은 읽기 화면(0524 cat-* 토큰)과
//   한 벌 — 읽는 쪽과 쓰는 쪽에서 같은 카테고리가 같은 색이어야 대응이 성립한다.
const CATEGORY_BAR: Record<CostCategory | 'FLIGHT', string> = {
  TRANSPORT: 'bg-cat-transport',
  PARKING: 'bg-cat-parking',
  FLIGHT: 'bg-cat-flight',
  FOOD: 'bg-cat-food',
  ACCOMMODATION: 'bg-cat-accommodation',
  ENTRANCE: 'bg-cat-entrance',
  ETC: 'bg-cat-etc',
};

// 0570 ③: 구 "이름 왼쪽 3px 세로 막대"(0527) 폐기 → 7px 원형 점. 읽기가 0567 ⑭에서 같은
//   전환을 했다 — 막대는 색만 말해 무엇인지 알 수 없고, 점은 항상 이름과 병기된다.
function CostRow({
  label,
  amount,
  currency,
  bar,
}: {
  label: string;
  amount: number;
  currency: Props['currency'];
  bar: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2.5">
      <span aria-hidden className={`w-[7px] h-[7px] rounded-full shrink-0 ${bar}`} />
      <span className="flex-1 text-base text-fg2">{label}</span>
      <span className="text-base font-semibold text-cost-amount tabular-nums">
        {formatAmount(amount, currency)}
      </span>
    </div>
  );
}

export function CostSection({ totals, flightAmount, total, currency }: Props) {
  // 0570 ④: 값이 0인 카테고리는 표시하지 않는다 — 읽기(summarizePlanCost의 `.filter(amount > 0)`)와
  //   같은 규칙. 구 조판은 0원 행을 hint 색으로 낮춰 남겼는데(0527), 카테고리가 7종이 되면서
  //   "주차비 ₩0"처럼 안 쓴 항목이 격자의 절반을 차지했다.
  //   정렬은 CATEGORIES 순서 유지 — 읽기는 비중 내림차순이지만 여기는 **입력 화면**이라
  //   금액을 고칠 때마다 행이 자리를 바꾸면 방금 고친 값을 눈으로 다시 찾아야 한다.
  const items = [
    ...(flightAmount > 0
      ? [{ key: 'FLIGHT', label: '항공', amount: flightAmount, bar: CATEGORY_BAR.FLIGHT }]
      : []),
    ...CATEGORIES.filter((cat) => totals[cat] > 0).map((cat) => ({
      key: cat,
      label: CATEGORY_LABEL[cat],
      amount: totals[cat],
      bar: CATEGORY_BAR[cat],
    })),
  ];

  // 0570 ④: 전부 0(새 계획 초기)이면 요약 블록 자체를 안 그린다 — 읽기의
  //   `if (ratios.length === 0) return null`(PublicCostSection)과 같은 처리.
  //   "총 ₩0 + 빈 막대"를 띄우는 대안은 아직 아무것도 안 한 화면에 0을 채워 넣는 셈이고,
  //   섹션 제목("예상 비용")과 아래 세 그룹은 호출부가 그리므로 무엇을 하는 자리인지는 남는다.
  //   값이 하나라도 생기면 즉시 나타난다.
  if (items.length === 0) return null;

  return (
    <>
      {/* 0570 ①: 총액을 카테고리 **위**로 — 읽기와 같은 순서(총액 → 누적 막대 → 카테고리 격자).
          구 하단 "총 비용 ₩…" 줄(0527)은 폐기. 크기는 24px/500 — 읽기의 26px/700보다 한 단
          낮다. 폼엔 위에 지표 밴드의 "총 비용"(20px)이 이미 있어 같은 값이 두 번 나오는데,
          아래쪽이 더 크면 어느 쪽이 정본인지 흐려진다. */}
      <div className="mt-[18px] text-[24px] font-medium tracking-[-0.02em] text-cost-total tabular-nums">
        총 {formatAmount(total, currency)}
      </div>

      {/* 0570 ②: 누적 막대 — 읽기와 같은 형태(구간 색 = 아래 점 색, 한자리 대응).
          flexGrow에 금액을 그대로 넘긴다: 읽기는 서버에서 반올림 보정한 정수 비중(ratio)을
          쓰지만 여기 값은 입력 중 실시간이라 보정할 대상이 아니고, flex 분배가 곧 비율이다.
          높이 10px·radius 5px — 읽기(12/6)보다 한 단 낮은 건 위 총액과 같은 이유. */}
      <div className="mt-3 flex h-[10px] rounded-[5px] overflow-hidden bg-surface2">
        {items.map((it) => (
          <div key={it.key} style={{ flexGrow: it.amount, flexBasis: 0 }} className={it.bar} />
        ))}
      </div>

      {/* 0527: 2열(좁으면 1열)로 한눈에. 0원 행이 사라져 실제 줄 수는 입력한 만큼만. */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-14">
        {items.map((it) => (
          <CostRow
            key={it.key}
            label={it.label}
            amount={it.amount}
            currency={currency}
            bar={it.bar}
          />
        ))}
      </div>
    </>
  );
}
