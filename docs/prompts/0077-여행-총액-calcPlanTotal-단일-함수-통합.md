# 0077 회고: 여행 총액 calcPlanTotal 단일 함수 통합

- 작성일: 2026-06-08
- 소요: 약 1시간
- 관련 커밋: `5c86dea`
- 변경 파일: lib/plan/calc-plan-total.ts(신규) / app/story/new/StoryWriteForm.tsx / app/(protected)/my-plan/[id]/PlanDetail.tsx / app/(protected)/my-plan/new/MyPlanNewForm.tsx / app/story/[id]/page.tsx / app/(protected)/my-plan/_components/CostSection.tsx

---

## 1. 한 줄 요약

여행 총액(plan_costs 합 + 항공 totalAmount)이 네 화면에서 따로 계산되던 것을 calcPlanTotal 단일 함수로 통합해, 화면 간 총액 불일치가 구조적으로 불가능하게 만들었다. 0074에서 적은 한계(미리보기·공개가 각자 계산)를 실제로 해결한 작업이다.

---

## 2. 왜 / 목적 / 이유

### 총액 계산을 한 곳으로 통합
- 왜: 총액을 화면마다 따로 계산하면 값이 어긋날 수 있고, 사용자가 "어느 숫자가 진짜냐"를 모르면 그 화면 전체의 신뢰가 깨진다(정보 신뢰성). 하나가 틀리면 나머지도 못 믿는다.
- 목적: 미리보기·공개·마이플랜이 항상 같은 총액을 보이는 상태.
- 이유: 0074에서 미리보기 총액이 항공을 빠뜨려 공개 금액과 달랐던 것은 증상이고, 근본 원인은 같은 식의 사본이 여러 곳에 있던 것이다. 식을 코드 한 곳(calcPlanTotal)에만 두고 모두가 호출하면, 고칠 곳도 한 곳이라 어긋날 자리가 사라진다.

### 저장(스냅샷)이 아니라 재계산을 택함
- 왜: 단일화 방식은 둘이다 — 저장 후 읽기 vs 단일 함수 재계산. 둘 다 화면 간 일치는 준다.
- 목적: 일치 + 플랜 변경 시 신선도 + 드리프트 방지.
- 이유: 저장 방식은 cost가 바뀔 때 저장값을 다시 맞춰야 하고, 한 번이라도 놓치면 저장값이 행과 어긋난다 — 신뢰성을 지키려다 드리프트로 신뢰가 깨진다. 재계산 단일 함수는 저장값이 없어 드리프트할 게 없고 항상 원본에서 derive한다. 0076에서 좋아요 카운트를 비정규화 컬럼 대신 _count로 조회한 것과 같은 이유다.

### total을 CostSection 필수 prop으로 (컴파일러 안전망)
- 왜: 계산 위치를 사람이 "다 찾았겠지"로 믿으면 누락이 런타임 침묵 버그가 된다.
- 목적: 호출부 하나라도 빠지면 컴파일 단계에서 걸리는 상태.
- 이유: total을 CostSection의 필수 prop으로 만들자, total을 안 넘긴 호출부가 타입 에러가 됐다. 실제로 탐색이 MyPlanNewForm을 놓쳤으나 tsc가 잡았다. 필수 prop은 "누락이 침묵 버그가 아니라 컴파일 에러"가 되게 하는 구조적 안전망이다.

---

## 3. 작성한 프롬프트

```
[배경]
0074 한계 후속. 여행 총액(plan_costs 합 + 항공 totalAmount)이 여러 곳에서 따로 계산됨
(마이플랜 / 스토리 링크 미리보기 / 스토리 공개 카드). 어긋날 수 있는 구조라 단일 함수로 통합.

[목표]
1. 총액을 계산하는 모든 위치를 먼저 탐색해 보고할 것 (어디서 어떻게 합산하는지).
2. 단일 함수(lib/plan/calcPlanTotal)로 추출 — plan_costs 합 + 항공 totalAmount.
3. 미리보기·공개·마이플랜이 모두 이 함수를 호출하도록 교체.

[하지 말 것]
표시 UI 변경 ❌ (계산 출처만 통합)
DB 스키마 변경 ❌

[검수 모드]
현재 계산 위치 목록을 plan에 포함 / 교체 후 모두 같은 함수 호출 / tsc
plan 요청.
```

검수 1순위는 "계산 위치를 빠짐없이 찾았는지"로 두었고, 실제로 탐색이 한 곳(MyPlanNewForm)을 놓쳐 이 우선순위가 유효함이 확인됐다.

---

## 4. 코드 작성 & 수정

```typescript
// lib/plan/calc-plan-total.ts (신규) — 식이 사는 단 한 곳
export function calcPlanTotal(
  costs: { amount: number }[],
  flight?: { totalAmount: number } | null,
): number {
  return costs.reduce((s, c) => s + c.amount, 0) + (flight?.totalAmount ?? 0);
}
```

```tsx
// app/(protected)/my-plan/_components/CostSection.tsx — total을 필수 prop으로
interface Props {
  totals: Record<CostCategory, number>;
  flightAmount: number;       // 카테고리 바 표시용으로 유지
  currency: 'KRW' | 'USD' | 'JPY';
  total: number;              // 추가 — 부모가 calcPlanTotal로 계산해 주입 (내부 계산 제거)
}
```

```tsx
// 네 호출부 모두 calcPlanTotal 경유
const total = calcPlanTotal(plan.costs, plan.flight);                       // 미리보기·상세·공개

// MyPlanNewForm은 이미 카테고리별로 합쳐진 값을 넣음 (합은 결합법칙이라 결과 동일)
const total = calcPlanTotal(
  Object.values(categoryTotals).map((amount) => ({ amount })),
  editor.flight,
);
```

---

## 5. 결과 / 배운점

- 같은 값을 여러 곳에서 계산하면, 지금 숫자가 우연히 맞아도 식의 사본이 여러 개라 나중에 또 어긋난다. 식을 한 곳에만 두면 고칠 곳도 한 곳이라 어긋날 자리가 없다. (0074·0076과 같은 관통 원칙 — 어긋남을 구조적으로 불가능하게.)
- 단일화에도 두 종류가 있다 — 저장 후 재사용(드리프트 위험) vs 한 함수로 재계산(드리프트 없음). _count와 같은 이유로 재계산을 택했다.
- 필수 prop은 컴파일러를 안전망으로 만든다. 탐색이 MyPlanNewForm을 놓쳤으나 tsc가 잡았다. "누락이 침묵 버그가 아니라 컴파일 에러"가 되게 하면, 사람의 완전 탐색에 기대지 않아도 된다.
- 숫자 일치(출력) ≠ 구조 통합. 표시가 다 맞아도 독립 계산이 남아있으면 또 어긋난다. grep으로 식의 사본이 없는지 확인해야 한다. (per-category 합은 총액과 별개 목적이라 남아도 무방.)
- 미결 결정: 발행된 공개 스토리는 "신선도(재계산) vs 발행 시점 동의 고정(스냅샷)"이 충돌하는 지점이다. 같은 "신뢰성"이 현재 플랜과 일치(재계산)와 발행 기록에 충실(스냅샷)으로 갈린다. 현재는 재계산(자동 반영)이며, 발행 후 플랜 수정 시 공개 금액이 바뀌어야 하는지는 제품 결정으로 남긴다.
