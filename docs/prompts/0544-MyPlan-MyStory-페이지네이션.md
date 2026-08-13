# 0544 MyPlan·MyStory 페이지네이션

**작성일**: 2026-08-07
**소요 시간**: 기록 없음
**관련 커밋**:
- feat - 0544 MyPlan 페이지네이션 - 공용 Pagination·클라 슬라이스(0416 방식) (5c7c277)
- feat - 0544 MyStory 페이지네이션 - 공용 Pagination·클라 슬라이스 (8afd195)
- fix - 0544 MyPlan·MyStory 스켈레톤 페이저 자리·카드 수 PAGE_SIZE 정정 (7add2c6)
- fix - 0544 STORY_PAGE_SIZE 클라 번들 격리 - prop 주입(StoryListPaged 방식) (b875aa1)

---

## 1. 한 줄 요약

전건 렌더이던 MyPlan·MyStory에 공용 Pagination + 클라이언트 슬라이스(플랜파인더 0416 방식) 페이지네이션을 적용하고, 0542 스켈레톤의 카드 수 근거를 뷰포트(8) → PAGE_SIZE(12)로 정정 + 페이저 자리 추가.

---

## 2. 왜 / 목적 / 이유

(초안 — 초안)

- **왜**: 네 화면이 같은 카드 그리드인데 MyPlan·MyStory만 전건 렌더로 방식이 달랐다.
- **층 선택**: MyPlan은 필터·정렬이 클라이언트라 페이지도 클라이언트여야 결과가 맞음(지시 명시). 플랜파인더가 이미 같은 계열 구조(0416)라 그대로 이식.
- **PAGE_SIZE 공유**: 12는 열 체계(1·2·3·4·6)의 공배수라 0532 "마지막 줄 채움" 규칙 자동 성립. 새 상수는 이중 기록이라 기존 상수 공유.

---

## 3. 작성한 프롬프트

```
[배경] MyPlan·MyStory가 전건 렌더 — 네 화면 같은 그리드인데 둘만 방식이 다름. 공용 Pagination을 붙인다.
[먼저 확인] ① 기존 두 목록의 구현(서버/클라, PAGE_SIZE 위치, URL, 인터페이스)
② MyPlan·MyStory 데이터 흐름 — 필터가 클라이언트면 페이지도 클라이언트 ③ PAGE_SIZE 공유 여부
[목표] 공용 Pagination 재사용 / 필터·정렬 상호작용 유지(필터 변경 → 1페이지) /
스켈레톤에 페이저 자리 / 카드 수 근거 PAGE_SIZE로 정정
[하지 말 것] ❌ 새 컴포넌트 ❌ 서버 페이지네이션 전환 ❌ 조판 변경 ❌ 푸시
[검수 모드] ①②③ 선보고 → plan / 필터·정렬 시 페이지 상태 확인 / 시프트 재확인 / npx tsc --noEmit
```

---

## 4. 코드 작성 & 수정

### 조사 결과
- 플랜파인더 = 클라 슬라이스(0416, page useState + 필터 변경 시 setPage(1) + 클램프 + scrollTo), 스토리 = 서버(URL ?page=). PAGE_SIZE 둘 다 12.
- MyStory 검색 페이지 리셋은 공짜: page.tsx `<ViewTransition key={listKey}>`가 결과 변경 시 그리드 remount → page state 초기화.

### MyPlanListClient — 0416 패턴 이식

```tsx
const [page, setPage] = useState(1);
const totalPages = Math.max(1, Math.ceil(sorted.length / PLAN_PAGE_SIZE));
const currentPage = Math.min(page, totalPages);   // 리셋 직전 프레임 방어 클램프
const pageItems = sorted.slice((currentPage - 1) * PLAN_PAGE_SIZE, currentPage * PLAN_PAGE_SIZE);
// 필터·정렬 onChange = (next) => { setFilter(next); setPage(1); }
// 페이지 변경 시 scrollTo(0,0) — useIsoLayoutEffect(첫 마운트 skip)
```

### MyStoryCardGrid — 동일 패턴 + pageSize prop 주입

`STORY_PAGE_SIZE` 정본(lib/story/queries)이 prisma를 import해 클라이언트에서 직접 가져오면 서버 의존이 클라 번들에 딸려옴 → **StoryListPaged와 동일하게 prop 주입** (page.tsx가 서버에서 전달). tsc는 못 잡는 층이라 import 그래프 확인으로 발견, 별도 fix 커밋.

### 스켈레톤 정정

두 loading.tsx: count 8 → PAGE_SIZE(12) 상수 참조(뷰포트 근거 주석 폐기), 페이저 자리(mt-10 h-11 w-[332px] 근사) 추가 — 0542 목록 스켈레톤과 동일형.

---

## 5. 결과 / 배운점

### 결과
- `npx tsc --noEmit` 전 커밋 통과. 변경 컴포넌트 대상 기존 테스트 없음.
- 필터·정렬 전환: setPage(1) + 클램프(플랜파인더와 동일 안전망). MyStory 검색: remount 리셋.
- 12건 이상에서 스켈레톤 그리드 높이 = 실그리드 1페이지 높이 → 페이저 위치까지 정합.
- 미이식 잔여: 플랜파인더의 인접 페이지 커버 프리로드(0431) — 넘김 순간 이미지 pop-in 가능, 후속 후보.

### 배운점
초안 — 클라 컴포넌트가 상수 하나를 가져올 때도 그 모듈의 import 그래프(서버 의존)가 함께 온다 — StoryListPaged의 prop 주입·PLAN_PAGE_SIZE 분리 파일이 전부 같은 이유였고, tsc는 이 층을 못 잡는다

---

## 결정 (Decisions)

- 클라 필터가 있는 목록의 페이지네이션은 같은 층(클라 슬라이스) — 0416 방식이 정본
- PAGE_SIZE는 화면군별 기존 상수 공유 (플랜 카드 = PLAN_PAGE_SIZE, 스토리 카드 = STORY_PAGE_SIZE)
- 클라이언트에서 서버 의존 모듈의 상수가 필요하면 prop 주입 (StoryListPaged 선례 준용)
- MyStory 검색 시 페이지 리셋은 listKey remount에 위임 (별도 상태 동기 없음 — 단일 소스)
