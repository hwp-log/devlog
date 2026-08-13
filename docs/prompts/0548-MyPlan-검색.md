# 0548 MyPlan 검색

**작성일**: 2026-08-07
**소요 시간**: 기록 없음
**관련 커밋**:
- feat - 0548 MyPlan 검색 - TagSearchBar 재사용, 클라 필터 층(제목·지역·작품) (1858ba7)
- fix - 0548 MyPlan 스켈레톤 검색바 자리 (dfca0f6)

---

## 1. 한 줄 요약

MyPlan에 검색 추가 — TagSearchBar를 무개조 재사용(onNavigate 위임으로 URL 네비 없이 클라 상태 수신, placeholder만 prop화), 검색 → 가격대 필터 → 정렬 → 슬라이스 단일 파이프라인으로 동시 적용 정합, 스켈레톤에 검색바 자리 동기.

---

## 2. 왜 / 목적 / 이유

(초안 — 초안)

- **왜**: 같은 소유자 목록인데 MyStory에만 검색이 있었다.
- **층 판정(클라이언트)**: 34건 전량이 이미 클라에 있고 필터·정렬·페이지가 전부 클라 — 검색만 서버면 두 층이 얽혀 동시 적용이 깨진다. MyStory(서버 검색·URL 공유)는 데이터 소유 구조가 달라 층 유지.
- **위치**: "새 계획" 버튼 아래 줄(사용자 지정 — MyStory의 헤더 우측 자리를 버튼이 이미 차지).

---

## 3. 작성한 프롬프트

```
[배경] MyStory에는 검색이 있는데 MyPlan에는 없다. MyPlan에도 붙인다.
[먼저 확인] ① MyStory 검색 구현(층·URL·대상 필드·디바운스·0544 맞물림)
② MyPlan 구조(클라 필터·정렬 — 검색도 같은 층?) ③ 층이 다르면 어느 쪽으로(34건 vs 11건)
[목표] 위치: "새 계획" 버튼 아래 / MyStory UI 재사용 / 필터·정렬과 동시 동작 / 검색 시 1페이지 / 스켈레톤 동기
[하지 말 것] ❌ 새 검색 컴포넌트 ❌ MyStory 동작 변경 ❌ 조판 변경 ❌ 푸시
[검수 모드] ①②③ 선보고 → plan / 동시 적용 정합 / 두 줄 간격 제안 / 360px / npx tsc --noEmit
```

---

## 4. 코드 작성 & 수정

### 조사 결과
- MyStory 검색: 서버 + `?q=`, TagSearchBar가 디바운스 300ms·IME 조합·정규화(trim·공백·# 제거) 내장, `onNavigate` 위임 prop 기설계. **별건 발견**: placeholder는 "제목, 지역명"인데 실쿼리는 태그 이름 contains뿐 — 문구·대상 어긋남(미수정, 보고만).
- 0544 페이지 복귀는 listKey remount로 공짜(MyStory).

### 구현

```tsx
// MyPlanListClient — onNavigate 위임: URL 네비 없이 클라 상태 수신 (컴포넌트 무개조 재사용)
<TagSearchBar q="" basePath="/my-plan" placeholder="제목, 지역, 작품을 입력하세요"
  onNavigate={(url) => {
    setQuery(new URL(url, location.origin).searchParams.get('q') ?? '');
    setPage(1); // 0544 필터와 동일 지점
  }} />
// 파이프라인: 검색(공백 제거 비교 — 정규화와 짝) → 가격대 → 정렬 → 슬라이스
const searched = items.filter((p) => [p.title, p.region, p.movie].some(
  (f) => f != null && f.replace(/\s/g, '').toLowerCase().includes(q)));
```

- TagSearchBar: `placeholder?` prop 추가(기본값 기존 문구 — MyStory 무변).
- 배치: 헤더(mb-6) → 검색바(mb-5) → 지표줄 → 필터(my-4) → 그리드. 360px는 전폭 한 줄(입력 16px §5).
- 빈 상태 문구 분기: 검색 중이면 `"…"에 맞는 계획이 없어요`(가격대 전제 문구 오표시 방지).
- 스켈레톤: 검색바 자리(h-10 w-full md:w-70, mb-5) 추가.

---

## 5. 결과 / 배운점

### 결과
- `npx tsc --noEmit` 두 커밋 통과. MyStory는 placeholder 기본값으로 동작 무변.
- 동시 정합: 단일 파이프라인이라 검색+필터+정렬+페이지 어떤 조합이든 같은 경로, 지표줄·페이저 동일 집합 파생.
- 잔여 보고: MyStory placeholder 문구("제목, 지역명")와 실검색 대상(태그) 어긋남 — 별도 사이클 후보.

### 배운점
초안 — 위임 prop(onNavigate)이 있는 컴포넌트는 소비처가 층을 바꿔 재사용할 수 있다 — URL을 상태 수신 채널로 쓰면 무개조 재사용이 가능

---

## 결정 (Decisions)

- MyPlan 검색 = 클라이언트 층 (전건 클라 소유 + 필터·정렬·페이지와 단일 파이프라인)
- 두 소유자 목록의 검색 층은 갈린 채 유지 (MyStory 서버 = URL 공유 구조, MyPlan 클라 = 전건 수신 구조 — 데이터 소유가 다르면 층도 다르다)
- 검색어 정규화(공백 제거)와 대상 필드 비교는 짝으로 — 한쪽만 제거하면 공백 낀 제목이 검색 불가
