# 0074 회고: CostPlan — 스토리에 플랜 연결

- 작성일: 2026-06-08
- 소요: 약 반나절
- 관련 커밋: c1a9846 (stories 테이블에 plan_id FK 추가) / 2643fde (작성·수정 폼에 플랜 연결 선택) / 28d5706 (스토리에 마이플랜 비용 공개 연동) / 6fab602 (미리보기 항공 비용 미반영 fix)

---

## 1. 한 줄 요약

공개된 스토리에 비공개 마이플랜을 연결해 여행 비용 데이터를 공개하는 CostPlan의 기반을 만들었다. stories.plan_id FK를 추가하고(1단계), 스토리 작성·수정에 opt-in 플랜 연결 UI를(2단계), plan_costs 공개 RLS와 비용 표시를(3단계) 적용했다. 도그푸딩에서 미리보기 총액과 공개 총액의 불일치를 발견해 수정했다.

---

## 2. 왜 / 목적 / 이유

### 플랜을 직접 공개하지 않고 스토리에 연결
- 왜: 플랜의 예산·날짜는 개인 도구로 입력된 사생활 데이터라 공개를 전제하지 않는다.
- 목적: 비용 데이터를 공개하되, 사용자가 명시적으로 동의한 경우에만.
- 이유: 동의를 플래그가 아니라 행위로 설계했다. 스토리에 플랜을 연결하는 행위 자체가 동의이고, 연결 시점에 공개될 금액을 미리보기로 보여줘 알고 하는 선택이 되게 했다. 스토리는 이미 공개 인프라(좋아요·RLS·사진)를 갖췄으므로, 공개(스토리)가 비공개(플랜)를 참조하는 방향이라 plans 테이블은 변경하지 않았다.

### 기본 정렬을 좋아요순으로
- 왜: 가격순 기본값은 비싼 여행을 상단에 노출해 자랑 경쟁을 유도한다.
- 목적: 공감받은 기록이 먼저 보이는 상태. 제품 목적(여행 기록 공유)과 신호를 정렬.
- 이유: 기본 정렬은 제품이 무엇을 장려하는지에 대한 선언이다. "측정해서 보여주는 것은 곧 장려하는 것." 가격순은 옵션으로 남겨 선택권은 주되, 기본 가치는 좋아요순으로 지켰다.

### 미래 날짜를 상대 날짜(Day1~N)로 — 설계 결정, 백로그
- 왜: 미래 여행 날짜 공개는 부재 기간 노출(빈집 위험)로 이어진다.
- 목적: 일정 흐름·기간은 유지하되 시점은 가린 상태.
- 이유: 날짜는 비용 참조라는 목적에 기여하지 않으므로 공개할 이유가 없다(데이터 최소화). Day1~N 상대 날짜는 기간 정보를 보존하면서 시점을 숨기고, 플랜 템플릿 공유(복사) 기능과도 맞는다. 0074에서는 비용만 공개(scope A)하고, 상대 날짜를 포함한 템플릿 공유는 scope B로 백로그에 남겼다.

### 도그푸딩 fix — 미리보기 총액 일치
- 왜: 미리보기 총액(₩140,000, plan_costs만)이 공개 카드 총액(₩253,844, 항공 포함)과 달랐다.
- 목적: 미리보기와 공개가 같은 금액을 보이는 상태 — 동의가 실제와 일치.
- 이유: 미리보기가 동의의 근거이므로, 미리보기가 틀리면 사용자가 동의한 금액과 다른 금액이 공개된다(동의 무효). 미리보기 쿼리에 항공 총액을 추가해 일치시켰다.

### ON DELETE 참조 설계
- 왜: 참조가 끊겼을 때 데이터가 어떠해야 하는가가 FK 종류를 정한다.
- 목적: 각 관계의 소속 성격에 맞는 삭제 동작.
- 이유: plan_flights는 CASCADE(항공은 플랜의 내용물 — 플랜이 사라지면 함께 사라진다), stories.plan_id은 SET NULL(스토리는 독립된 기록 — 플랜이 사라져도 글은 남고 연결만 끊긴다), my_plans.source_story_id은 비-FK 소프트 참조(출처 메모). 같은 plans.id를 가리켜도 소속 관계가 다르면 삭제 동작이 다르다.

---

## 3. 작성한 프롬프트

### 1단계 — stories.plan_id FK

```
[배경]
0074 CostPlan 1단계. 공개된 스토리에 마이플랜을 연결해 비용 데이터 공개의 기반을 만든다.
연결 방향은 스토리 쪽 FK — 마이플랜(plans) 테이블은 변경하지 않는다. 한 플랜에 스토리 하나만 연결(1:1).

[목표]
stories 테이블에 plan_id 컬럼 추가 마이그레이션 1건.
제약: nullable / unique / FK → plans.id / ON DELETE SET NULL.

[하지 말 것]
plans 테이블 변경 ❌
연결 UI ❌ (2단계)
RLS 정책 변경 ❌ (3단계)
CostPlan 페이지 ❌ (4단계)
기존 스토리 데이터 변경 ❌ (컬럼 추가만)

[참조 패턴]
plan_flights.plan_id → plans.id FK (0068). plan_id 타입은 이와 동일하게.

[검수 모드]
planId 필드는 optional(?) + @unique / onDelete: SetNull / 제약 4개 전부 마이그레이션 SQL에 반영
plan 요청.
```

### 2단계 — opt-in 플랜 연결 UI (요약)

스토리 작성·수정 폼에 "내 플랜 연결" 셀렉트 + 연결 시 공개될 금액 미리보기. 서버 액션에서 planId 소유권 검증(plan.ownerId !== user.id → 거부) 후 저장.

### 3단계 — plan_costs 공개 RLS + 비용 표시 (요약)

연결된 플랜의 plan_costs만 공개 SELECT 허용(EXISTS: 그 plan_id를 가리키는 스토리가 있으면). plan_flights는 행 단위 RLS로 시각 정보를 가릴 수 없어 컬럼을 열지 않고, 총액만 서버 select로 표시. 상세 페이지는 마이플랜의 CostSection 공용 컴포넌트 재사용.

---

## 4. 코드 작성 & 수정

```prisma
// prisma/schema.prisma — stories에 plan_id
model Story {
  // ...
  planId String? @unique @map("plan_id")
  plan   MyPlan? @relation(fields: [planId], references: [id], onDelete: SetNull)
}
```

```typescript
// app/story/new/actions.ts — planId 소유권 검증 (★★★★★)
if (planId) {
  const plan = await prisma.myPlan.findUnique({ where: { id: planId }, select: { ownerId: true } });
  if (!plan || plan.ownerId !== user.id) throw new Error('연결할 수 없는 플랜입니다');
}
```

```sql
-- plan_costs 공개 RLS (연결된 스토리가 있을 때만)
CREATE POLICY "plan_costs_public_select" ON "plan_costs"
FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM stories WHERE stories.plan_id = plan_costs.plan_id));
```

```typescript
// 미리보기 총액 fix — 항공 총액 추가 (증상 패치)
// before: plan_costs 합산만 → ₩140,000
// after:  plan_costs 합산 + flight.totalAmount → ₩253,844 (공개 카드와 일치)
```

---

## 5. 결과 / 배운점

- 동의는 플래그가 아니라 행위로 설계할 수 있다 — 미리보기를 본 행위가 동의가 된다.
- 미리보기는 동의의 근거다. 미리보기가 틀리면 동의가 거짓이 된다. 도그푸딩 중 미리보기 총액이 항공편을 빠뜨려 공개 금액과 달랐고, 이는 표시 버그가 아니라 동의 무효 문제였다.
- 기본 정렬은 가치 선언이다. 측정·노출이 행동을 유도한다(자랑 경쟁 방지를 위해 좋아요순 기본).
- ON DELETE는 데이터의 소속 관계가 정한다 — CASCADE(내용물) / SET NULL(독립 기록) / 비-FK(출처 메모).
- 한계: 미리보기 총액 불일치를 항공편 추가로 맞췄으나, 미리보기와 공개가 여전히 각자 계산한다. 항공이라는 빠진 조각을 더한 증상 패치이고, 근본 수정은 총액 계산을 단일 함수로 공유해 구조적으로 어긋날 수 없게 만드는 것이다(0077에서 진행).
- 관통 원칙: 같은 값을 수동으로 동기화하지 말고, 어긋남이 구조적으로 불가능하게 만들어라. (0076의 DB 제약·_count 조회와 같은 원칙.)
