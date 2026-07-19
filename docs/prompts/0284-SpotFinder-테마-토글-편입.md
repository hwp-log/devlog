# 0284 회고: SpotFinder 테마 토글 편입 (3단계) — 강제 다크 해제 + 라이트 대응 + 지도 재생성

**작성일**: 2026-07-19
**소요 시간**: 약 1시간
**관련 커밋**: `535f50f` feat: 0284 SpotFinder 테마 토글 편입 - DARK_ROUTES 해제, 라이트 지도 타일·기능 상실분 대응

---

## 1. 한 줄 요약

SpotFinder의 강제 다크 2곳(DARK_ROUTES·page 자체 data-theme)을 해제해 루트 토글(0283)에 편입하고, 다크 전용 5개 지점(지도 타일·marker-hover·미선택 pill·3열 구분선·선택 행)에 라이트 쌍을 추가했으며, 테마 전환 시 지도를 파괴·재생성(center/zoom 보존)해 배경·타일 스타일이 이전 테마로 굳지 않게 배선.

---

## 2. 왜 / 목적 / 이유

- **왜**: SpotFinder만 DARK_ROUTES로 다크 강제라 토글을 무시했다. 멘토 피드백(dark-only 고수 vs theme switch 편입)에 편입으로 답하는 지점.
- **목적**: SpotFinder를 전역 토글에 편입해 라이트/다크 둘 다 대응.
- **이유**: 다크 토큰이 이미 라이트 쌍을 가져 편입 비용이 작았고(marker-hover 라이트값 + getComputedStyle 재실행 정도), 라이트 시안을 만든 것 자체가 라이트 의향. 지도 타일은 customStyleId 런타임 변경이 네이버 API 미지원이라, 라이트=SDK 기본 타일 / 다크=커스텀으로 가고 전환 시 지도 파괴·재생성(center/zoom 보존).

---

## 3. 작성한 프롬프트

```
[배경]
라이트/다크 토글 트랙 3단계. 현재 SpotFinder만 DARK_ROUTES로 다크 강제라 토글을 무시.
멘토 피드백에 대해 편입으로 결정. SpotFinder를 토글에 편입해 라이트/다크 둘 다 대응.

[목표]
1. ThemeScope의 DARK_ROUTES에서 '/spot-finder' 제거 → 루트 토글을 따르게.
2. marker-hover 라이트 대응값 추가.
3. getComputedStyle로 지도 색·토큰을 읽는 곳이 테마 변경 시 재실행되게 배선.

[하지 말 것]
화면 하드코딩 토큰화(4단계) ❌ / theme.ts 쌍 구조 변경 ❌ (추가만) /
카카오 지도 3종·spot-color.ts ❌ (동결) / 커밋·푸시 ❌

[검수 — plan 확정]
라이트에서 실제 라이트로 뜨는지 전수 / getComputedStyle 위치와 감지 방식 추천 /
다크값만 있는 토큰 전수. (plan 중 결정: 지도 타일 라이트=SDK 기본 스타일,
대응 범위=기능 상실분 포함)
```

---

## 4. 코드 작성 & 수정

### 1. 강제 다크 해제 (2곳 — 한쪽만 빼면 무의미)

```tsx
// app/(protected)/_components/ThemeScope.tsx
const DARK_ROUTES: string[] = [];  // 0284: '/spot-finder' 해제 — 기전은 유지

// app/(protected)/spot-finder/page.tsx — data-theme="dark" 속성 제거
<div className="bg-bg-deep">
```

### 2. `lib/theme.ts` — 마커 토큰 6쌍 추가 (다크 = 기존 리터럴 이관, 라이트 = 판단값)

```ts
light: { ..., markerPillHi: '#ffffff', markerPillBorder: 'rgba(25,26,28,0.18)',
  markerHoverHi: '#f2f2f5', markerHoverLo: '#e2e2e8',
  markerHoverBorder: 'rgba(25,26,28,0.35)', markerHoverFg: '#191a1c' },
dark:  { ..., markerPillHi: '#33383d', markerPillBorder: 'rgba(255,255,255,0.5)',
  markerHoverHi: '#454b52', markerHoverLo: '#33383d',
  markerHoverBorder: 'rgba(255,255,255,0.8)', markerHoverFg: '#e5e7eb' },
```

### 3. `app/globals.css` — marker-hover 리터럴 → var() (단일 규칙 유지)

```css
.marker-hover [data-pill] {
  transform: scale(1.12);
  background: linear-gradient(to bottom, var(--marker-hover-hi), var(--marker-hover-lo)) !important;
  border-color: var(--marker-hover-border) !important;
  color: var(--marker-hover-fg) !important;
}
```

### 4. `components/SpotFinderMapNaver.tsx` — pill 토큰화 + 페어 + 재생성 배선

```ts
// 미선택 pill: #33383d·흰 테두리 → 토큰 (마커 DOM은 페이지 트리 안이라 var() 해석)
: 'background:linear-gradient(to bottom,var(--marker-pill-hi),var(--surface2));...border:1px solid var(--marker-pill-border);...'

// 구분선 ×2: lg:border-border dark:lg:border-[rgba(255,255,255,0.12)]
// 선택 행 ×2: bg-black/[0.08] dark:bg-white/[0.16]

// 재생성 배선 — useTheme 구독(0283 원칙: 렌더에 쓰지 않고 effect에서만)
const { resolvedTheme } = useTheme();
useEffect(() => {
  if (!ready || !resolvedTheme || !mapDivRef.current) return;  // undefined 이중 init 차단
  const view = viewRef.current;  // 테마 전환 재생성 시 직전 center/zoom 우선
  const mapBackground = getComputedStyle(mapDivRef.current).getPropertyValue('--card').trim();  // 재실행 시 재읽기 자동
  const map = new naver.maps.Map(mapDivRef.current, {
    center: new naver.maps.LatLng(view?.lat ?? first?.lat ?? INITIAL_CENTER.lat, ...),
    zoom: view?.zoom ?? INITIAL_ZOOM,
    ...(supportsGl ? { gl: true, ...(resolvedTheme === 'dark' ? { customStyleId: ... } : {}) } : {}),
  });
  return () => {
    const c = map.getCenter() as naver.maps.LatLng;  // 파괴 직전 뷰 캡처
    viewRef.current = { lat: c.lat(), lng: c.lng(), zoom: map.getZoom() };
    ...
  };
}, [ready, resolvedTheme]);
```

### 5. `components/SpotFinderLoadingSkeleton.tsx` — 구분선 페어 ×2 (4번과 동일 패턴)

---

## 5. 결과 / 배운점

### 결과
- 빌드 성공, `npm test` 기존 실패(6스위트/8테스트) 외 증가 없음 — 회귀 0.
- `/spot-finder` 서빙 HTML에서 `data-theme="dark"` **요소 속성 0건** 확증 (grep 매치 2건은 인라인 `<style>`의 CSS 셀렉터 텍스트 — 속성 아님).
- 마커 토큰 6쌍이 :root(라이트)와 `[data-theme="dark"]` 블록 양쪽에 발행됨을 서빙 HTML에서 실측 확인.
- getComputedStyle 3곳 중 테마 의존은 `--card` 1곳뿐(--sab·paddingBottom은 테마 무관) — 재생성 경로에 포함되어 별도 배선 없이 해결.
- 구현 중 오류 1건: JSX 루트 요소 앞(return( 직후)에 JSX 주석을 둬 파싱 실패 — 일반 주석으로 이동해 해결.
- 0269·0270·0272 회고 파일은 존재하지 않아(마커 사실 서술 0건) 회고 정정 대상 없음.
- 브라우저 수동 검증 잔여(사용자): 라이트 타일·서피스 확인, 토글 시 재생성 + center/zoom 유지, hover 대비(양 테마), 하이드레이션 경고 0건. 라이트 6값은 판단값 — 실기기 대비 조정 대상.

### 배운점
- getComputedStyle로 지도 색을 읽는 3곳(D-2 지뢰)이 지도 재생성 흐름에 자동 포함돼 해결 — 재생성될 때 색을 다시 읽으니까. 별도 배선 불필요.
- 지도 재생성 깜빡임은 구조적(customStyleId 런타임 변경 불가)이라 transition으로 못 잡음. 저빈도 조작이라 v1.0 이후 폴리시로 백로그.

---

## 결정 (Decisions)

- **지도 타일: 라이트 = SDK 기본 스타일(customStyleId 미적용) / 다크 = 기존 커스텀 스타일** — 라이트 전용 Style Editor 스타일 제작은 기각(추가 작업 대비 실익), setOptions 런타임 시도는 미문서화라 기각.
- **테마 전환 = 지도 파괴·재생성** — customStyleId 런타임 변경 API 부재(공식 문서·@types 확인 불가). center/zoom은 cleanup에서 ref 캡처로 보존. 타일 재로드 비용은 전환 빈도가 낮아 수용.
- **테마 변경 감지 = next-themes useTheme 구독** — MutationObserver 기각(공식 구독 경로가 있는데 DOM 감시는 이중 소스 + 정리 부담). resolvedTheme은 렌더에 쓰지 않고 effect 게이트로만(0283 원칙 연장).
- **다크 전용 리터럴의 라이트 쌍은 토큰(theme.ts) 또는 dark: variant 페어로** — 값이 마커처럼 CSS/inline HTML 양쪽에서 소비되면 토큰(단일 소스), Tailwind 클래스 한 곳이면 variant 페어(새 토큰 남발 방지).
- DARK_ROUTES 기전은 빈 배열로 유지 — 향후 화면별 강제 모드가 다시 필요하면 1줄 복원.
