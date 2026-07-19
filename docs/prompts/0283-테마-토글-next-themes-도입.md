# 0283 회고: 테마 토글 (2단계) — next-themes 도입 + 루트 data-theme + FOUC 방지

**작성일**: 2026-07-19
**소요 시간**: 약 1시간
**관련 커밋**: `eb08ca4` feat: 0283 라이트/다크 토글 UI 추가 - next-themes 도입, localStorage 저장
(plan은 chore 의존성 분리 커밋을 예상했으나, 실제로는 package.json·package-lock.json이 이 feat 단일 커밋에 함께 포함됨 — AGENTS.md "의존성 추가와 기능 구현은 별도 커밋" 관례와 어긋난 이력으로 명기)

---

## 1. 한 줄 요약

next-themes를 도입해 문서 루트(html) 레벨의 data-theme 상태 관리 + localStorage 복원(`dotrip-theme`) + 첫 페인트 전 차단 스크립트(FOUC 방지)를 붙이고, UserDropdown 메뉴에 2단(라이트/다크) 토글 항목을 추가 — 라이트 기본, SpotFinder 강제 다크(DARK_ROUTES)는 스코프 중첩으로 무변 유지.

---

## 2. 왜 / 목적 / 이유

- **왜**: 스위칭 엔진은 있으나 이를 돌리는 UI·상태가 없었다. FOUC(로드 시 라이트로 번쩍) 방지를 자체 구현하면 App Router에서 hydration 미스매치가 잘 난다.
- **목적**: 라이트 기본 + 다크 선택 가능한 토글. 선택은 localStorage에 저장, 계정 저장은 setTheme 훅 자리만 남겨 v1.0 이후로 미룸.
- **이유**: FOUC 방지·attribute 매핑이 검증된 next-themes 채택. 업계 표준상 테마 선택은 localStorage가 1순위(계정 저장도 깜빡임 때문에 localStorage 이중 저장 필요). enableSystem=false로 2단(라이트/다크) — 0282에서 prefers를 뺀 것과 일관.

---

## 3. 작성한 프롬프트

```
[배경]
라이트 기본 + 다크 토글 테마 트랙 2단계. 1단계(0282)에서 data-theme가 유일 스위칭이 됨.
엔진(theme.ts → buildThemeCss → [data-theme=dark])은 있으나, 이를 돌리는 UI·상태가 없음.

[목표]
1. data-theme를 html/body(문서 루트) 레벨에서 제어하는 테마 상태 관리 추가.
2. 선택을 localStorage에 저장, 재방문 시 복원. 우선순위: 저장값 > 없으면 라이트 기본.
3. 테마 읽기/쓰기를 단일 지점으로 격리 — 추후 계정 저장 훅 자리만 남김.
4. 토글 UI 컴포넌트 배치.
5. 로드 시 깜빡임(FOUC) 방지 — 첫 페인트 전 저장값 반영.

[하지 말 것]
계정 저장 구현 ❌ / prefers-color-scheme 재도입 ❌ / DARK_ROUTES 손대기 ❌ /
하드코딩 토큰화 ❌ / theme.ts 구조 변경 ❌ / 커밋·푸시 ❌

(plan 검토 중 결정 확정: next-themes 도입 + 토글 2단. 승인 전 재확증 4건 —
attribute 설정·배치 위치·FOUC 충분성·루트 라이트+스코프 다크 중첩 우선순위.)
```

---

## 4. 코드 작성 & 수정

### 1. `app/(protected)/_components/ThemeProvider.tsx` (신규)

```tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// 2단(라이트/다크) 고정: enableSystem={false} + defaultTheme="light" = prefers-color-scheme 미참조(0282 결정 유지).
// attribute="data-theme" = 라이브러리 기본값이지만 buildThemeCss([data-theme=dark], lib/theme.ts)와의 페어를 명시.
// storageKey "dotrip-theme" = localhost 공유 origin에서 타 프로젝트의 "theme" 키와 충돌 회피.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      storageKey="dotrip-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
```

### 2. `app/layout.tsx` — suppressHydrationWarning + Provider 래핑

```tsx
    // suppressHydrationWarning: next-themes가 첫 페인트 전 html의 data-theme를 수정 (1레벨만 적용)
    <html lang="en" suppressHydrationWarning className={...}>
      <body className="min-h-full flex flex-col">
        <style id="dotrip-theme">{buildThemeCss()}</style>
        <ThemeProvider>{children}</ThemeProvider>
```

### 3. `app/(protected)/_components/ThemeToggle.tsx` (신규) — 하이드레이션 안전 렌더

```tsx
'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

// useTheme 반환값은 서버에서 undefined라 렌더에 쓰면 하이드레이션 미스매치 —
// 두 상태를 모두 렌더하고 표시는 dark: variant(CSS)가 전환, useTheme은 onClick에서만 소비.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function handleToggle() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    // [v1.0+] 계정 저장 훅 자리: 로그인 사용자면 여기서 Server Action으로 서버 동기화
  }

  return (
    <button type="button" role="menuitem" onClick={handleToggle}
      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-fg2 hover:bg-slate-50 dark:hover:bg-surface2 transition-colors duration-150">
      <span className="flex items-center gap-2 dark:hidden"><Moon size={14} /> 다크 모드</span>
      <span className="hidden items-center gap-2 dark:flex"><Sun size={14} /> 라이트 모드</span>
    </button>
  );
}
```

### 4. `app/(protected)/_components/UserDropdown.tsx` — 메뉴 항목 삽입

```tsx
          <hr className="border-slate-100 dark:border-border my-1" />
          <ThemeToggle />
          <form action={signOut}>
```
(story/layout.tsx가 UserDropdown을 이미 import — 두 셸 자동 반영)

---

## 5. 결과 / 배운점

### 결과
- `npm run build` 성공. 서빙 HTML에 next-themes 차단 스크립트 주입 확증 — 설정 인자 실측: `("data-theme","dotrip-theme","light",null,["light","dark"],null,false,true)` (attribute·storageKey·defaultTheme·enableSystem=false 그대로).
- `/spot-finder` 서빙 HTML에 내부 `data-theme="dark"` 3곳(ThemeScope·page div) 유지 — 루트 관리와 스코프 다크 공존 확증.
- 컴파일 CSS에 `dark\:flex:where([data-theme=dark],...)` 등 토글 아이콘 CSS 분기 정상 생성.
- `npm test`: 기존 실패(6스위트/8테스트) 외 증가 없음 — 회귀 0.
- 0282 잔여였던 landscape-blocker 라이트 고정은 html 레벨 data-theme 상속으로 자연 해소.
- 커밋 구성 정정(사실): plan은 chore 의존성 분리 커밋을 예상했으나 실제는 `eb08ca4` feat 단일 커밋에 package.json·package-lock.json 포함 — AGENTS.md "의존성 추가와 기능 구현은 별도 커밋" 관례와 어긋난 이력.
- 검증 중 함정 1건: 이전 세션의 `next start` 프로세스가 3111 포트를 계속 점유해 구 빌드가 서빙됨 → "스크립트 미주입"으로 오판할 뻔. `lsof -ti :3111 | xargs kill` 후 정상 확인.
- 브라우저 수동 검증 잔여(사용자): ① 토글 클릭 → html data-theme 전환 + localStorage 저장 ② 새로고침 시 FOUC 없음 ③ 하이드레이션 콘솔 경고 0건.

### 배운점
- 루트 data-theme(라이트) + SpotFinder 하위 data-theme(다크) 중첩 시, CSS 상속 근접성으로 안쪽이 이겨 SpotFinder 다크가 유지됨. 이 우선순위를 승인 전에 셀렉터 구조로 확증한 게 핵심.
- 커밋 구성 반성: package.json·lock을 feat 단일 커밋(eb08ca4)에 포함시켰다. AGENTS.md의 의존성 별도 커밋 관례와 어긋난 이력 — 다음엔 chore(의존성)와 feat를 분리.

---

## 결정 (Decisions)

- **next-themes 채택** (손코딩 대안 기각): 차단 스크립트 자동 주입 + html만 수정(스코프 다크와 무충돌) + 커뮤니티 검증. 단 기본값 함정 2개를 반드시 오버라이드 — `defaultTheme`(기본 "system")→"light", `enableSystem`(기본 true)→false. `attribute`는 기본값이 이미 `data-theme`(class가 opt-in).
- **테마 의존 UI는 useTheme을 렌더에 쓰지 않는다** — 서버 undefined라 미스매치. 두 상태를 모두 렌더하고 `dark:` variant(CSS)로 표시 전환, useTheme은 이벤트 핸들러에서만.
- **토글 위치 = UserDropdown 메뉴 항목** — (protected)·story 두 셸이 공유하는 유일 메뉴 컴포넌트라 1곳 삽입으로 전 화면 커버. 계정 메뉴 내 테마 항목은 업계 표준 위치.
- **localStorage 키 = `dotrip-theme`** — localhost 공유 origin에서 타 프로젝트 "theme" 키와 충돌 회피.
- **forcedTheme 미사용** — SpotFinder 강제 다크는 기존 DARK_ROUTES 스코프(상속 근접성으로 루트와 무관하게 성립)가 담당.
