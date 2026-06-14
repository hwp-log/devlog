# 0104~0105 회고: CostPlan을 PlanFinder로 변경

- 작성일: 2026-06-14
- 소요: 약 1시간
- 관련 커밋:
  - b5a3b3f `chore: 0104 메뉴·목록 표시 라벨을 PlanFinder로 변경`
  - 33d66f9 `refactor: 0105 CostPlan을 PlanFinder로 경로·컴포넌트명 전면 변경`

---

## 1. 한 줄 요약

서비스 메뉴명을 CostPlan에서 PlanFinder로 바꿨다. 0104에서 사용자에게 보이는 라벨 2곳만 먼저 바꾸고, 0105에서 경로·폴더·컴포넌트명까지 전면 통일했다. 단 DB 컬럼명(`sourcePlanId` 등)은 바꾸는 비용·위험이 크고 사용자 가치가 없어 CostPlan 시절 흔적을 그대로 남겼다.

---

## 2. 왜 / 목적 / 이유

### 라벨(0104) → 경로·이름(0105) 단계 분리

- 왜: 이름 변경은 "보이는 것"과 "보이지 않는 구조"의 변경 비용이 다르다. 라벨은 2줄 텍스트라 즉시·안전하지만, 경로·폴더·컴포넌트명은 참조처가 줄줄이 딸려와 한 곳만 빠져도 404·깨진 링크가 생긴다.
- 목적: 사용자에게 보이는 이름을 먼저 빠르게 바꿔두고, 구조 변경은 따로 안전하게 진행하는 상태.
- 이유: 0104에서 NavLinks label·페이지 h1만 PlanFinder로 바꿔 사용자 체감을 먼저 확보하고(`chore`), 0105에서 경로·폴더·컴포넌트명을 전면 통일했다(`refactor`). 커밋 타입도 분리했다 — 0104는 보이는 텍스트 정리라 chore, 0105는 동작 불변의 구조 정리라 refactor.

### 어디까지 바꿀지 선 긋기 — DB 컬럼명은 남김

- 왜: 코드 이름과 DB 컬럼명은 변경 비용·위험이 다르다. 컴포넌트·경로명은 텍스트라 컴파일러가 틀린 곳을 잡아주고 git으로 되돌릴 수 있어 싸고 안전하다. 반면 DB 컬럼명은 운영 DB의 RENAME 마이그레이션이 필요하고, 이미 저장된 데이터(담기로 만들어진 플랜들의 sourcePlanId 값)를 깨뜨릴 위험이 있으며 롤백도 무겁다. 게다가 `sourcePlanId`는 사용자에게 안 보이는 내부 식별자라 바꿔도 사용자 가치가 0이다.
- 목적: 보이는 이름은 일관되게 통일하되, 안 보이고 위험만 큰 DB 컬럼명은 건드리지 않는 상태.
- 이유: "비용·위험은 큰데 + 사용자 가치는 0" 두 가지가 겹치니 안 바꾸는 게 명확한 정답이다. 비용만 봐도, 가치만 봐도 한쪽으로 기울지 않으므로 둘을 함께 저울에 올려 "여기까지"를 그었다. 간판·메뉴판(코드 이름·경로)은 새 이름으로 갈되, 창고 박스 라벨(DB 컬럼명)은 손님이 안 보고 헤집으면 위험만 크니 옛 이름으로 둔 것. 0103에서 sourcePlanId를 FK 없는 plain String 스냅샷으로 둔 "데이터는 한번 박으면 함부로 안 건드린다"는 감각의 연장이다.

### 전면 변경에 grep "잔존 참조 0건" 검증

- 왜: 리네임은 "다 바꿨다고 생각했는데 한 곳 남는" 게 전형적 함정이다. 한 곳만 옛 경로를 가리켜도 404가 난다.
- 목적: cost-plan·CostPlan 참조가 코드 어디에도 안 남은 것을 확정한 상태.
- 이유: 수정 전 grep으로 참조 15곳(8파일)을 먼저 목록화하고, 수정 후 `grep -rn "cost-plan\|CostPlan" ./app`으로 0건임을 재확인했다. 추측("다 바꿨겠지")이 아니라 검색으로 못 박았다.

> tsc가 `cost-plan/page.js`를 못 찾는다는 에러를 냈는데, 코드 문제가 아니라 Next의 `.next/types` 빌드 캐시에 남은 옛 경로 잔재였다. `rm -rf .next/types` 후 통과 — 코드가 아니라 캐시를 의심한 판단이 시간을 아꼈다.

---

## 3. 작성한 프롬프트

0105 경로·이름 전면 변경 시, 수정 전에 참조처를 먼저 훑게 하는 "읽고 보고만" 단계를 앞에 뒀다.

```
[배경]
0104에서 표시 라벨만 PlanFinder로 바꿈(NavLinks label, page.tsx h1).
이제 경로·폴더·내부 참조까지 PlanFinder로 일관 변경.
라우트: /cost-plan → /plan-finder, 폴더 cost-plan → plan-finder.

[먼저 — 읽고 보고만]
수정·plan 전에, /cost-plan 또는 cost-plan을 참조하는 곳을 전부 grep해서 목록만 보고:
- 폴더·파일 경로 / import 경로 / href·redirect·router.push
- revalidatePath('/cost-plan'...) / 컴포넌트·함수명 CostPlan*
읽고 목록만. 수정·plan ❌.

[목표 — 목록 확인 후]
1. 폴더 cost-plan → plan-finder 이동
2. 내부 import 경로 전부 갱신
3. href·redirect·router.push /cost-plan/... → /plan-finder/...
4. revalidatePath /cost-plan → /plan-finder
5. 컴포넌트·함수명 CostPlan* → PlanFinder* (합의 후)

[하지 말 것]
❌ git 커밋 (현우가 수동)
❌ 기능·쿼리·정밀 비용 처리 변경 (이름·경로만)
❌ 목록 누락 — grep 미확인 참조는 건드리지 말 것
❌ DB·스키마 변경 (sourcePlanId 등 데이터는 그대로)

[검수 모드]
- /cost-plan·CostPlan 잔존 참조 0건 (grep 재확인)
- /plan-finder, /plan-finder/[id] 정상 진입
- 마이플랜 "원본 플랜 보기"가 /plan-finder/[id]로 연결
- 담기·좋아요·정렬 동작 그대로
- tsc 통과
먼저 grep 목록만 보고. plan은 그 다음.
```

---

## 4. 코드 작성 & 수정

### 0104 — 표시 라벨만 (2 files)

```tsx
// app/(protected)/_components/NavLinks.tsx — label만 (href는 0105에서)
{ href: '/cost-plan', label: 'PlanFinder' },   // label: CostPlan → PlanFinder

// app/(protected)/cost-plan/page.tsx — h1
<h1 ...>PlanFinder</h1>   // CostPlan → PlanFinder
```

### 0105 — 경로·폴더·이름 전면 (11 files)

```bash
# 폴더·파일 이동
mv "app/(protected)/cost-plan" "app/(protected)/plan-finder"
mv ".../CopyCostPlanButton.tsx" ".../CopyPlanFinderButton.tsx"
mv ".../CostPlanDetail.tsx" ".../PlanFinderDetail.tsx"
```

```tsx
// 컴포넌트·함수명 + 참조처 동시 갱신
// CopyCostPlanButton → CopyPlanFinderButton (정의 + import + JSX)
// CostPlanDetail     → PlanFinderDetail     (정의 + import + JSX)
// CostPlanDetailPage → PlanFinderDetailPage
// CostPlanPage       → PlanFinderPage

// 경로 문자열
// NavLinks: href '/cost-plan' → '/plan-finder'
// PlanCard: `/cost-plan/${id}` → `/plan-finder/${id}`
// actions: revalidatePath('/cost-plan'...) → '/plan-finder'...
// my-plan/PlanDetail: `/cost-plan/${plan.sourcePlanId}` → `/plan-finder/${plan.sourcePlanId}`
//   ↑ 경로 문자열만 변경, sourcePlanId 컬럼명은 불변
```

> DB 컬럼(`sourcePlanId`·`sourceNickname`)·schema·쿼리 로직은 건드리지 않음. 동작 불변.

---

## 5. 결과 / 배운점

- 검증 통과: grep `cost-plan\|CostPlan` 0건, tsc 통과(.next/types 캐시 정리 후), PlanFinder 탭 → /plan-finder 진입, 카드 → /plan-finder/[id] 진입, "내 여행으로 담기" → 마이플랜 이동, "원본 플랜 보기" → /plan-finder/[id] 연결, 담기·좋아요·정렬 동작 그대로.
- 배운점 1: 변경의 비용·위험과 사용자 가치를 함께 저울질해 "어디까지"를 긋는다. "일관성"이라는 명분에 휩쓸려 다 바꾸는 게 아니라, 보이는 이름(코드·경로)은 싸고 안전하니 통일하고, 안 보이고 위험만 큰 DB 컬럼명은 가치가 0이라 남겼다. 무지성 통일이 아니라 의식적으로 선을 그은 것.
- 배운점 2: 보이는 것 먼저, 구조는 따로. 라벨(0104)을 먼저 바꿔 사용자 체감을 빠르게 확보하고, 참조처가 딸려오는 경로·이름(0105)은 분리해 안전하게 진행했다. 커밋 타입도 chore(텍스트)와 refactor(구조 정리)로 갈랐다.
- 배운점 3: 리네임은 grep으로 못 박는다. "다 바꿨겠지"라는 추측이 가장 위험하다. 수정 전 참조 목록화, 수정 후 잔존 0건 재확인으로 누락을 구조적으로 막았다. 그리고 tsc 에러가 떴을 때 코드가 아니라 빌드 캐시(.next/types)를 의심한 게 정답이었다 — 에러 메시지의 출처를 먼저 확인한다.
