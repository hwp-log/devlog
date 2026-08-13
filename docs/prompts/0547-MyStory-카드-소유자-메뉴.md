# 0547 MyStory 카드 소유자 메뉴

**작성일**: 2026-08-07
**소요 시간**: 기록 없음
**관련 커밋**:
- refactor - 0547 카드 ⋯ 메뉴 셸 공용 추출 - CardOverflowMenu (0d34352)
- fix - 0547 deleteStoryAction redirect 목적지 파라미터화 - 기본 /story 무변 (413c06c)
- feat - 0547 MyStory 카드 소유자 메뉴 - 편집·삭제, 하트 하단 이동 (68ef3d3)

---

## 1. 한 줄 요약

MyPlan 카드(0530)의 ⋯ 메뉴 방식을 MyStory 카드에 이식 — 셸(CardOverflowMenu) 공용 추출 후 편집·삭제 2항목(공개 전환·상태 배지는 Story 모델에 개념 부재로 제외), 하트는 MyPlan과 같은 문법으로 하단 메타줄 이동.

---

## 2. 왜 / 목적 / 이유

(초안 — 초안)

- **왜**: 같은 소유자 화면인데 MyPlan에만 관리 수단이 있어 갈렸다.
- **배지·공개 전환 제외**: Story 모델에 isPublic·isDraft 필드 자체가 없다(전부 공개) — 없는 개념을 억지로 만들지 않음(지시).
- **하트 하단 이동**: 소유자 카드에서 하트는 "남이 누른 수 표시"(토글 아님, MyPlan과 동일 의미) — 상단 = 관리(⋯), 하단 = 지표 문법을 두 소유자 카드에서 통일.

---

## 3. 작성한 프롬프트

```
[배경] MyPlan 카드엔 상태 배지·⋯ 메뉴(0530)가 있는데 MyStory엔 없다. 같은 방식을 붙인다.
[먼저 확인] ① MyPlanCard 구현(마크업·액션·클릭 분리) ② 스토리 대응 기능(공개 개념?
편집·삭제 액션 재사용?) ③ 조판 충돌(하트와 ⋯ 자리, MyPlan처럼 하트 하단 이동?)
[목표] MyPlan 패턴·컴포넌트 재사용 / 없는 개념은 항목에서 빼고 보고 / 삭제 확인 절차 상세와 동일
[하지 말 것] ❌ 새 서버 액션(없으면 보고 후 판정) ❌ 상세 편집·삭제 제거 ❌ 그리드·카드 크기 ❌ 푸시
[검수 모드] ①②③ 선보고 → plan / 카드·메뉴 클릭 상호 배타 / 360px 메뉴 이탈 / npx tsc --noEmit
```

---

## 4. 코드 작성 & 수정

### 조사 결과
- MyPlanCard: 카드 전체 absolute Link + **⋯는 형제 z-20** (중첩 인터랙티브 회피 — stopPropagation 불요). StoryCard는 루트가 Link라 같은 수법을 쓰려면 래퍼 필요.
- deleteStoryAction 재사용 가능하나 말미 `redirect('/story')` 고정 — /my-story에서 부르면 공개 목록으로 튕김.

### 커밋 1 — 셸 추출
`CardOverflowMenu`: ⋯ 버튼(시각 32+터치 44, 호버 노출·data-[open])·외부 클릭·ESC·팝오버(172px) + `MENU_ITEM_CLASS`/`MENU_DANGER_CLASS` export. **항목은 render-prop `(close) => items`** — confirm 취소 시 열림 유지 같은 닫힘 시점을 항목이 결정(기존 행동 보존). 위치는 `positionClass` prop(기본 MyPlan 13/14px, 스토리는 칩 인셋 정렬 right-2 top-2). MyPlanCardMenu는 셸 소비로 전환 — 항목·문구·행동 무변.

### 커밋 2 — 액션 파라미터화
`deleteStoryAction(storyId, redirectTo = '/story')` — 상세 호출부 무변, 신설 아님.

### 커밋 3 — 이식
- `MyStoryCard`(신설): `group relative` 래퍼 > `StoryCard ownerView` + 셸(편집 Link → /story/[id]/edit / 구분선 / 삭제 — `confirm('정말 삭제하시겠습니까?')` 상세와 동일 문구 → `deleteStoryAction(id, '/my-story')`)
- `StoryCard`: `ownerView?: boolean`(기본 false = 공개 목록 무변) — 상단 하트 생략 + 칩 행 pr-10(⋯ 밑 침범 방지, MyPlanCard pr-[52px] 수법) + 하단 메타줄 끝 `· ♥N`
- `MyStoryCardGrid`: StoryCard → MyStoryCard

---

## 5. 결과 / 배운점

### 결과
- `npx tsc --noEmit` 전 커밋 통과. 그리드·카드 크기 무변, 공개 목록(/story)은 ownerView 기본 false로 무영향.
- 클릭 상호 배타: 형제+z 구조라 구조적으로 보장(카드 → Link 상세 / ⋯ → z-20 버튼).
- 360px: 1열 카드 폭 ~312 > 팝오버 172(right-2 앵커) — 이탈 없음. 팝오버는 래퍼 기준이라 이미지 overflow-hidden 밖에서도 안 잘림.

### 배운점
초안 — 공용 셸 추출 시 "닫힘 시점"처럼 소비처마다 다른 행동은 render-prop으로 소비처에 남겨야 기존 행동이 안 바뀐다

---

## 결정 (Decisions)

- 소유자 카드 문법 통일: 상단 = 관리(⋯), 하단 = 지표(♥) — MyPlan·MyStory 공통
- 카드 ⋯ 메뉴 셸 정본 = `_components/CardOverflowMenu` (항목·닫힘 시점은 소비처 책임)
- 모델에 없는 개념(스토리 공개/비공개·초안)은 UI를 만들지 않는다 — 항목 제외가 정답
- 목록·상세가 같은 파괴 액션을 공유할 땐 redirect 목적지만 파라미터로 가른다 (액션 복제 금지)
