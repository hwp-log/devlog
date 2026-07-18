# 0274~0280 회고: SpotFinder 지도 로딩 UX (게이트 분리 + 로딩 서피스)

**작성일**: 2026-07-18
**소요 시간**: 약 5시간
**관련 커밋** (0274~0280, 7커밋):
- `0fab4c7` docs: 0274 SpotFinder 로딩 상태 정본 시안 추가
- `1b6c9a4` style: 0275 셔머·map-pin-breathe keyframe + skeleton-shimmer 유틸
- `1aea3ce` feat: 0276 네이버 로더 상태머신 (타임아웃·재시도·인증구분)
- `266d999` feat: 0277 SpotFinder 지도 게이트 분리 + 지도 슬롯 로딩/에러 서피스
- `906a62d` feat: 0278 SpotFinder dynamic-import 폴백 셔머 스켈레톤
- `a9b6d12` fix: 0279 지도 타일 전 흰 깜빡임 제거 (background 다크 주입)
- `593145e` style: 0280 모바일 지도 슬롯 안내를 시트 추종 가시 영역 중앙으로

---

## 1. 한 줄 요약

네이버 지도 SDK 로딩(gl 서브모듈, 실측 5~30초) 동안 `!ready` early-return으로
화면 전체가 단색 pulse로 붕괴하던 것을, 대기를 지도 슬롯 하나로 좁혀 리스트·상세는
서버 데이터로 즉시 렌더하고 지도 슬롯만 셔머+지도핀 breathe 로딩 서피스를 표시.
로더에 종결 장치(느린 성공 구분·수동 재시도·인증 구분)를 신설하고, 실기기 검증에서
발견된 웜캐시 흰 깜빡임(0279)·모바일 시트 가림(0280)을 후속 보정. 로딩 정본 시안
2편을 목업 폴더에 편입(0274).

---

## 2. 왜 / 목적 / 이유

### 게이트 분리 (지도만 기다리게)
- **왜**: 지도 SDK(gl 서브모듈)가 5~30초 걸리는 동안, 이미 서버에서 다 내려온
  리스트·상세까지 지도에 인질로 잡혀 화면 전체가 빈 pulse로 붕괴했다.
  "1안(로딩 화면만 예쁘게)"도 검토했으나, 그건 이미 손에 있는 데이터를 계속
  가려두는 낭비였다.
- **목적**: "데이터가 준비돼 있으면 즉시 보여준다"를 지도 로딩과 분리해 관철.
  사용자가 지도 대기 중에도 실제 촬영지 목록을 보고 탐색할 수 있게.
- **이유**: 사전 확증으로 리스트·상세 JSX가 `window.naver` 비의존(props-only)이고
  상세 데이터가 prop에 전량 포함됨을 확인 → early-return 위치만 옮기면 마커·시트
  로직을 안 건드리고 게이트를 분리할 수 있었다(저위험). "예쁜 로딩"보다
  "인질 해제"가 근본 해결.

### 로더에 종결 장치 (느린 성공은 죽이지 않음)
- **왜**: 기존 로더엔 타임아웃이 없어, `onJSContentLoaded`(gl 완료 콜백)가 늦으면
  `error`도 `ready`도 아닌 무한 대기였다. 30초+ 케이스가 실제로 이 경로였다.
- **목적**: 무한 대기에 탈출구를 주되, "느린 성공"(결국 도착하는 로드)을 성급히
  죽이지 않기.
- **이유**: 30초+는 실패가 아니라 gl이 늦게 도착하는 "느린 성공"임을 코드로
  확증했다. 그래서 타임아웃 재시도가 진행 중 로드를 죽이면 곧 올 로드를 오히려
  늦춘다 → `slow`는 안내만, 재시도는 진짜 실패(onerror)에만. 인증 실패는
  재시도해도 무의미하니 별도 메시지.

### 모바일 안내 위치 — B안(고정) 기각 → 2안(시트 추종)
- **왜**: B안(한 위치 고정)은 초기 시트(half) 기준으론 안 가렸지만, 사용자가
  로딩 중 시트를 peek↔half로 움직이면 그 순간 안내가 제자리에 붕 떠 어색했다.
- **목적**: 시트가 어느 상태로 움직여도 안내(특히 재시도 버튼)가 항상 가시 영역
  중앙에 자연스럽게 보이게.
- **이유**: 실기기에서 B안을 직접 보고 판단했다. "먼저 싼 것(고정)으로 해보고
  이상하면 바꾼다"로 B안을 먼저 시도 → 실사용에서 어색함 확인 → 시트 추종이
  업계 표준(Turo: 시트 이동 시 콘텐츠 중심 재조정)임을 검색으로 확인하고 2안으로
  전환. 실사용 판정이 설계를 바꾼 사례.

---

## 3. 작성한 프롬프트

> 실제 세션에서 던진 프롬프트 기준(길이상 축약, [배경]/[목표]/[하지 말 것] 구조 유지).

### 사전 조사 (0277의 근거 확증)
```
[배경] SpotFinder 지도 로딩 UX 개선 전 사실 확증. SDK 로딩 5~30초 동안
MapNaver가 !ready로 통째 early-return(:860 단색 pulse)해서 리스트·상세까지
같이 붕괴하는 걸 확인함. 이번엔 읽고 보고만.
[읽고 보고만]
1. 리스트 행·상세 패널 JSX가 window.naver나 지도 인스턴스 ref를 참조하는지
2. fetchSpotFinderSpots() 리턴에 상세 데이터가 포함되는지
3. h-spot-finder-map 높이 계산식(svh 기반 여부)
4. useNaverMapsLoader에서 onload 후 onJSContentLoaded만 늦는 경로 확증
```

### 로딩 시안 편입 관례 확증 (0274의 근거)
```
[배경] 로딩 시안 확정. 목업 폴더에 "로딩 상태 정본 시안"으로 넣으려 함.
[읽고 보고만] 1. 기존 파일 명명 규칙 2. 데탑·모바일 파일 분리 여부
3. README 규칙 전문 4. 셔머가 참조한 --t5/--t4의 theme.ts 대응값
5. 기존 시안 포맷(DC 번들 vs 정적 HTML) — 수기 정적 HTML 혼재 문제 여부
```

### 본 구현 (0275~0278)
```
[목표]
1. 게이트 분리 — !ready 대기를 지도 슬롯 하나로만 좁힘
2. 지도 슬롯 로딩 서피스 — 셔머 + 지도핀 breathe(1.4s, opacity 0.4~0.85)
   + "지도를 불러오는 중" 라벨
3. 셔머 스켈레톤 — globals.css에 shimmer keyframe 신설
4. 최소 표시 시간 — show-delay 150~300ms + 최소 노출 300~500ms
5. 로더 타임아웃 — 30초+는 "느린 성공"이라 죽이지 말 것. 진짜 실패(onerror)
   일 때만 수동 "다시 시도". 인증 실패는 별도 메시지.
[하지 말 것] 리스트·상세·마커·시트 로직 변경 ❌ / SDK 로드 방식 변경 ❌ /
색 리터럴 ❌ / plan 요청.
```

### 웜캐시 흰 깜빡임 (0279)
```
[배경] 웜캐시 재진입 시 지도 영역 흰 깜빡임. 네이버 지도가 타일 로드 전
자기 기본 배경(밝은 회색)을 그림. 공식 MapOptions `background` 옵션 확증.
[적용] getComputedStyle로 --card 실값을 읽어 background 주입 + div bg-card
이중 방어. tileTransition 기본값 유지. 리터럴 하드코딩 금지.
```

### 커밋 위임 (0274~0279 확정 번호·주석 정정 포함)
```
[커밋 — 순서·번호로, 파일 콕 집어서] 0274 docs 시안 3파일 / 0275 style /
0276 feat 로더 / 0277 feat 게이트+슬롯 / 0278 feat 폴백 / 0279 fix 깜빡임.
코드 주석에 남은 "0274" → 각 확정 번호로 정정 후 커밋. 같은 파일(0277·0279)은
청크 분리. Co-Authored-By 금지 / git add . 금지 / push 금지.
```

### 모바일 시트 가림 → B안 고정 (0280 1차)
```
[배경] 모바일 로딩 핀+라벨이 초기 시트(half)에 가려 안 보임(실기기).
[목표] 핀 세로 위치를 모바일에서만 위로 — half 가시 영역(상단 42svh) 중앙
근처(핀 중심 ≈ 20~24svh) 고정(B안). 시트 상태 prop 전달 ❌. lg: 데탑 무변.
```

### B안 → 2안 시트 추종 전환 (0280 확정)
```
[배경] B안 실기기 검증 — 시트를 내려도 안내가 고정돼 어색. 넓어진 가시 영역
중앙으로 따라 내려가는 게 자연스럽고 업계 표준(Turo). 미커밋이라 0280을 2안으로.
[목표] sheetLevel prop 전달 → 각 스냅 상태의 가시 영역 중앙 계산 → 시트와
동일 transition(320ms·cubic-bezier(0.32,0.72,0,1)) 동조.
[하지 말 것] 드래그 실시간 추적(slideOffset) ❌ — 2단 스냅 기준 transition만.
```

---

## 4. 코드 작성 & 수정

> 모든 코드 블록은 커밋된 실제 파일에서 확증(재구성 아님).

### 0274 — 로딩 정본 시안 3파일 (docs)

`docs/design/mockups/`에 수기 정적 HTML 2편 추가 + README 갱신.
기존 번들 포맷과 달리 수기 정적임을 헤더에 명시, 색은 근사값+정본 병기.

```html
<!-- Dotrip Desktop Loading.html 헤더 -->
<!--
  Dotrip 로딩 상태 정본 시안 — 데스크탑
  · A005 v3 §9 기준, SpotFinder 지도 로딩 UX 확정 시안 (2026-07-18)
  · 색값의 정본은 lib/theme.ts — 이 파일의 리터럴 hex는 시각 대조용 근사값
-->
```

```markdown
<!-- README.md — 파일명 표기 정정(언더스코어→공백) + 로딩 시안 항목 추가 -->
- Dotrip Desktop.html / Dotrip Mobile Final.html — 2026-07-10 최종 시안 (기획 문서 A005 v3 §9)
- Dotrip Desktop Loading.html / Dotrip Mobile Loading.html — SpotFinder 지도 로딩 상태 시안 (2026-07-18, 수기 정적 HTML)
- 색값의 정본은 lib/theme.ts — 이 HTML의 --t 변수 이름은 참조 금지, 시각 대조 전용
```

### 0275 — 셔머·breathe keyframe + 유틸 (style)

```css
/* app/globals.css — 색은 theme.ts 토큰 var 경유(리터럴 금지), 시안 리듬 1.4s */
@keyframes shimmer {
  to { background-position: -200% 0; }
}
@keyframes map-pin-breathe {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.85; }
}
@utility skeleton-shimmer {
  background: linear-gradient(100deg, var(--popover) 40%, var(--surface2) 50%, var(--popover) 60%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
```

### 0276 — 로더 상태머신 (feat)

로드 메커니즘(script 주입·onJSContentLoaded 대기·싱글턴)은 유지, 상태 계층만 신설.
반환 `{ready, error}` → `{status, slow, retry}`.

```typescript
// lib/naver/useNaverMapsLoader.ts
export type NaverLoaderStatus = 'loading' | 'ready' | 'error' | 'authError';

// 실패 종류 구분 — authFailure(설정 문제, 재시도 무의미) vs onerror(네트워크, 재시도 가능)
class NaverLoadError extends Error {
  kind: 'auth' | 'network';
  // ...
}

// 로딩이 이 시간(ms)을 넘겨도 loading이면 slow=true (정보 표시 전용 — status 불변, 죽이지 않음)
const SLOW_MS = 15000;

// 수동 재시도 — 이벤트 핸들러라 동기 setState 허용. 자동/무한 재시도 없음.
const retry = useCallback(() => {
  const attempt = ++attemptRef.current;
  setStatus('loading');
  setSlow(false);
  load(attempt);
}, [load]);
```

### 0277 — 게이트 분리 + 지도 슬롯 서피스 (feat)

`!ready`/`error` early-return 2개 제거 → 메인 return 상시 렌더.
`ready = status === 'ready'` 파생으로 하위 마커·스크롤·리사이즈 로직 무변경.
show-delay 200ms + 최소 노출 400ms는 지도 슬롯 전용(리스트·상세 미적용 —
서버 데이터가 이미 있어 즉시 렌더).

```typescript
// components/SpotFinderMapNaver.tsx
const { status, slow, retry } = useNaverMapsLoader();
const ready = status === 'ready'; // 하위 기존 ready 참조 무변경 유지
const mapSlot = useMapSlotPhase(status); // show-delay/최소노출 위상 훅 (파일 로컬)
```

```tsx
{/* 지도 영역 안 — mapDivRef 형제 오버레이(z-20 = 시트 z-30·모달 z-60 아래) */}
{mapSlot === 'loading' && <SpotFinderMapSlot variant="loading" ... slow={slow} />}
{mapSlot === 'error' && <SpotFinderMapSlot variant="error" ... onRetry={retry} />}
{mapSlot === 'auth' && <SpotFinderMapSlot variant="auth" ... />}
```

신규 `components/SpotFinderMapSlot.tsx`: loading(셔머+핀 breathe+라벨) /
error("다시 시도" 44px 버튼) / auth(설정 안내, 버튼 없음) 3변형 순수 표시 컴포넌트.

### 0278 — dynamic-import 폴백 셔머 스켈레톤 (feat)

```tsx
// components/SpotFinderMapWrapper.tsx — 단색 pulse → 3열 스켈레톤
const SpotFinderMap = dynamic(() => import('./SpotFinderMapNaver'), {
  ssr: false,
  loading: () => <SpotFinderLoadingSkeleton />,
});
```

신규 `components/SpotFinderLoadingSkeleton.tsx`: 데이터·naver 비의존 정적 골격
(데탑 목록행+지도+상세 / 모바일 지도+하단 시트) — 청크 로드 전 유일 구간이자
"리스트·상세 셔머"가 실재하는 유일한 곳(마운트 후엔 실데이터 즉시 렌더).

### 0279 — 웜캐시 흰 깜빡임 제거 (fix)

```typescript
// components/SpotFinderMapNaver.tsx — init effect 내부
// documentElement 금지: 다크 값은 [data-theme=dark] 스코프에만 발행(theme.ts buildThemeCss)
// — 루트에서 읽으면 라이트 card. 지도 div(다크 스코프 내부)에서 읽는다.
const mapBackground = getComputedStyle(mapDivRef.current).getPropertyValue('--card').trim();
const map = new naver.maps.Map(mapDivRef.current, {
  // ...
  background: mapBackground, // 타일 전 배경 = card
});
```

```tsx
{/* div 1차 방어(인스턴스 배경과 이중) */}
<div ref={mapDivRef} className="w-full h-full bg-card" />
```

### 0280 — 모바일 안내 시트 추종 (style)

B안(pt-[20svh] 고정)을 실기기 기각 후 2안으로 확정. absolute 래퍼 +
`top: 가시영역 중앙` + `-translate-y-1/2`(콘텐츠 높이 무관 정중앙) +
시트와 동일 transition 동조. 데탑은 lg:static으로 outer flex 센터링 복귀.

```typescript
// components/SpotFinderMapSlot.tsx
// SHEET_MAX_H(SpotFinderMapNaver)와 페어 — 한쪽만 바꾸면 어긋남
const SLOT_TOP = {
  half: 'top-[calc((100svh-max(58svh,359px+env(safe-area-inset-bottom)))/2)]',
  peek: 'top-[calc((100svh-150px-env(safe-area-inset-bottom))/2)]',
} as const;

function slotInnerClass(sheetLevel: 'peek' | 'half'): string {
  return `absolute inset-x-0 ${SLOT_TOP[sheetLevel]} -translate-y-1/2 transition-[top] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col items-center gap-3 lg:static lg:translate-y-0 lg:transition-none`;
}
```

```tsx
// components/SpotFinderMapNaver.tsx — sheetLevel prop 배선 (state 단일 소스, MapSlot은 파생 소비)
{mapSlot === 'loading' && <SpotFinderMapSlot variant="loading" sheetLevel={sheetLevel} slow={slow} />}
```

---

## 5. 결과 / 배운점

### 결과 (사실)
- 정적 검증: 변경 파일 전부 `tsc --noEmit` 통과 · eslint 0 errors
  (경고 2건은 기존 exhaustive-deps 패턴). jest 기준선(8 failed/86 passed —
  기존 실패군) 유지, stash 전/후 대조로 회귀 0 확증.
- 게이트 분리로 SDK 대기 중에도 리스트·검색·상세·시트가 서버 데이터로 즉시 렌더.
  상세 데이터는 `fetchSpotFinderSpots()` prop에 전량 포함(클릭 시 재조회 없음)이
  코드로 확증돼 상세 스켈레톤 자체가 불필요했음.
- 실기기 검증에서 2건 발견 → 후속 보정: ① 웜캐시 재진입 시 타일 전 흰 깜빡임
  (0279, SDK `background` + `bg-card` 이중 방어) ② 모바일 로딩 안내가 초기 시트에
  가림(0280, B안 고정 → 실기기 재검증 후 2안 시트 추종으로 전환 확정).
- ESLint `react-hooks/set-state-in-effect` 에러 2건을 구현 중 검출 —
  effect 본문 동기 setState를 타이머·프로미스 콜백으로 옮겨 해소.
- 지시 스니펫의 `getComputedStyle(document.documentElement)`는 이 레포에선
  라이트 card를 반환함을 사전 확증으로 발견, 다크 스코프 내부 요소 읽기로 정정
  (다크 값은 `[data-theme=dark]` 스코프에만 발행되는 구조).

### 배운점
- **로딩은 "무엇을 기다리는가"로 쪼개면 붕괴 범위가 준다.** 화면 전체가 한
  의존성(지도 SDK)에 묶여 있었는데, 각 영역이 실제로 뭘 기다리는지 분리하니
  (지도만 SDK, 리스트·상세는 이미 서버 데이터) 붕괴가 지도 슬롯 하나로 좁혀졌다.
  "로딩 화면을 예쁘게"가 아니라 "무엇이 무엇에 묶여 있나"를 먼저 물어야 했다.
- **실측·실사용이 판단을 바꾼다.** 두 번 겪었다. ① 30초+가 "실패"인 줄 알았는데
  코드 확증으로 "느린 성공"이었고, 그게 재시도 설계를 바꿨다. ② B안(고정)이 맞는
  줄 알았는데 실기기에서 시트를 움직여보니 어색했고, 2안(추종)으로 갔다. 책상에서
  옳아 보이던 게 실물에서 뒤집혔다.
- **추측을 코드 확증이 잡는다.** 흰 깜빡임 해결로
  `getComputedStyle(document.documentElement)`를 쓰라고 지시했는데, 실제론 다크
  값이 `[data-theme=dark]` 스코프에만 발행돼 루트에서 읽으면 라이트 card가 나왔다.
  "아마 루트에서 읽으면 되겠지"가 틀렸고, 코드를 읽고서야 다크 스코프 내부 요소에서
  읽어야 함을 알았다. 외부 API 사실은 검색으로, 내부 구조는 코드로 확증하는 2단이
  없었으면 흰색을 흰색으로 덮을 뻔했다.
- **싸게 시작해 실물로 판정하는 게 빠르다.** B안(고정, 단순)을 먼저 만들고 실기기
  에서 보고 2안(추종, 복잡)으로 갔다. 처음부터 복잡도를 올리지 않고, 실사용 없이는
  알 수 없는 부분을 실물로 판정한 뒤 필요한 만큼만 올렸다.

---

## 결정 (Decisions)

- **로딩 게이트는 의존 대상별로 분리**: SDK 대기는 지도 슬롯만. 서버 데이터
  (리스트·상세)는 즉시 렌더. 스켈레톤은 dynamic-import 폴백 구간 전용.
- **느린 성공(30초+)은 실패로 처리하지 않음**: `slow`는 정보 표시 전용.
  재시도 버튼은 네트워크 실패(onerror)에만, 자동·무한 재시도 없음.
  인증 실패는 별도 메시지·재시도 없음.
- **show-delay(200ms)+최소노출(400ms)은 지도 슬롯에만** — 웜캐시 깜빡임 억제.
- **지도 타일 전 배경 = card 토큰 주입**(SDK `background` 옵션 + div `bg-card`
  이중). CSS 변수 실값은 다크 스코프 내부 요소에서 읽는다(documentElement 금지).
- **모바일 오버레이 안내 위치 = 시트 스냅 상태 추종(2안)**: 각 스냅의 가시 영역
  수학적 중앙(`top` calc + `-translate-y-1/2`), 시트와 동일 transition
  (320ms·cubic-bezier(0.32,0.72,0,1)) 동조. 고정 위치(B안)는 실기기 기각.
  드래그 실시간 추적은 비채택(2단 스냅 기준 보간만).
- **파생 상수 페어 관례 적용**: `SLOT_TOP`(MapSlot) ↔ `SHEET_MAX_H`(MapNaver)
  상호 참조 주석 — 한쪽만 바꾸면 어긋남.