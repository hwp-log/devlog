# 0164 회고: SpotFinder 다크 전환과 3열 구조 완성 (디자인 트랙 8커밋)

- **작성일**: 2026-08-10 (소급 작성 — 작업일 2026-07-11 밤 ~ 07-12 오전)
- **소요 시간**: 약 6시간 (이틀에 걸침)
- **관련 커밋** (8건):
  - `adacfd8` 다크 전환 - 첫 디자인 토큰 소비자
  - `b3d947c` 풀블리드 다크 - 레이아웃 라우트 분기(ThemeScope)
  - `9f1a285` 마커·클러스터 primary 재배색 - theme.ts 첫 TS 소비
  - `8b68de8` 데탑 상세를 우측 고정 패널로 전환 (A005 미결1 잠정 채택)
  - `8ee7aff` 좌측 스팟 리스트 열 추가 - 3열 구조 완성
  - `1b211fc` 데탑 풀블리드 전환 - 프레임 철거·헤더 좌측 열 이동
  - `605f280` 공유 헤더 전폭·3분할 전환 - 내비 중앙 정렬, 활성 점, Write primary 채움

## 1. 한 줄 요약

0163 토큰 배선의 첫 소비자로 SpotFinder를 잡아, 다크 전환 → 풀블리드 → 마커 재배색 → 우측 고정 패널 → 좌측 리스트(3열 완성) → 프레임 철거 → 공유 헤더 전폭까지 — "카드 안의 지도"를 "화면 그 자체인 지도"로 바꾸는 시안 배치 정합을 한 트랙으로 완주했다.

## 2. 왜 / 목적 / 이유

- **왜(문제)**: A005 v3까지 디자인은 확정됐는데 실코드는 라이트 slate 하드코딩 그대로였다. 멘토 관심 구역이 SpotFinder이고 멘토링 지참물이 "돌아가는 SpotFinder"라, 여기부터 시안을 실물로 만들어야 했다.
- **목적(목표 상태)**: A005 §8 배정(SpotFinder = 다크, "스틸컷이 어둠 위에서 발광")과 시안 3열 구조(좌 리스트 320 | 지도 1fr | 우 패널 350)가 실코드로 성립한 상태.
- **이유(순서 결정)**: 애초에 "라이트 전 화면부터"를 검토했으나(면적이 본체, 값 변화가 작아 안전) plan 실측에서 "다크 전환 자체가 토큰 유틸 배관 공사를 겸한다"는 게 확인되며 기술 의존성이 사라졌고, 남은 기준(범위 작음·멘토 관심·의욕)이 전부 다크 쪽을 가리켜 순서를 뒤집었다. 우측 고정 패널은 A005 §7 미결 1의 잠정 채택(v2안) — 실물을 들고 멘토링에서 v1(플로팅)과 비교 확정하는 그림.

## 3. 작성한 프롬프트 (트랙 대표 2건)

```
[배경] lib/theme.ts + Tailwind v4 배선 완료(0163). 아직 소비자 0.
A005 §8: SpotFinder = 다크 모드. 나머지 화면은 라이트 유지.
[목표] 1. 라우트 최상위에 data-theme="dark" — 하위만 스코프, 타 화면 무영향
2. 하드코딩 색·slate-* → 토큰 유틸 치환(bg-bg/card, fg/fg2/muted 위계, border)
3. primary는 A005 §2 역할대로: 활성 칩·선택 배지·링크만
4. 매핑표를 plan에 제시 — 토큰에 없는 색은 치환 말고 보고
[하지 말 것] ❌ 레이아웃·간격 변경(색만) ❌ 타 화면 ❌ 색 발명 ❌ 지도 타일
[검수 모드] plan 요청.
```

```
[배경] 3열 완성. 남은 갭 = 페이지 레이아웃 층: 눈썹+헤드라인 블록 →
rounded-2xl 카드 안에 3열. 시안은 헤더 바로 아래 풀블리드 + 눈썹·제목은 좌측 열 상단.
[목표] 1. 시안 실측(높이 산출·좌열 헤더) 2. 프레임 철거 — 3열이 헤더 아래
가용 영역(svh 기준, CLAUDE.md §5) 3. 헤드라인 좌측 열 이동, A005 §5 확정값
(16px/600) 4. 모바일 현행 유지
[하지 말 것] ❌ 모바일 ❌ 3열 내부 재수정 ❌ 카피 변경 ❌ 발명
[검수 모드] plan 요청.
```

## 4. 작성·수정한 코드

> ⚠️ 소급 작성 — 커밋 전 CC "읽고 보고만"으로 현재 파일과 대조할 것. (특히 이후 0170~0547 사이 대규모 변경으로 파일 구조가 달라졌을 가능성 높음 — AppHeader 통합 등)

```tsx
// app/(protected)/_components/ThemeScope.tsx — 라우트별 다크 스코프
'use client';
const DARK_ROUTES = ['/spot-finder']; // A005 §8 배정표의 유일한 코드 표현
export function ThemeScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDark = DARK_ROUTES.some((r) => pathname.startsWith(r));
  return <div data-theme={isDark ? 'dark' : undefined} className="min-h-screen">{children}</div>;
  // children-as-props라 하위 RSC를 클라이언트화하지 않음
}
```

```tsx
// app/(protected)/_components/ProtectedMain.tsx — 풀블리드 라우트 분기
const FULL_BLEED_ROUTES = ['/spot-finder'];
// 풀블리드: 공유 main의 max-w·패딩 제거. 지도 높이 = calc(100svh - 57px)
// 57 = 헤더 56 + border 0.5px×2 반올림 — 56.5로 두면 dpr=1에서 1px 스크롤바 발생(실측)
```

```tsx
// 공유 헤더 — 전폭 3분할 (max-w-7xl 제거)
<header className="grid grid-cols-[1fr_auto_1fr] items-center px-6">
  <Logo />
  <NavLinks />               {/* 활성: text-primary + 아래 4px 점, 굵기 600→400 (A005 §5) */}
  <div className="col-start-3 justify-self-end"> {/* 모바일에서 NavLinks 소멸 시
       grid 자동배치로 아바타가 중앙 열로 흘러가는 함정 — col-start-3 고정 */}
    <WriteButton /> {/* .btn-soft → bg-primary 흰 글자 pill, 아이콘 제거(시안 실측) */}
  </div>
</header>
```

## 5. 결과 / 배운 점

- **결과**: 시안 3열 배치가 실물로 성립. Playwright 실기동 검증(scrollHeight===clientHeight, 리사이즈 후 지도 폭 610px=1280-320-350 추종)까지 통과. 이 트랙의 화면이 이후 멘토링 지참물의 본체가 됐다.
- **빈 상태 채택이 설계로 문제를 소거한 사례**: 우측 패널을 "미선택 시 숨김"으로 했으면 마커 클릭 → panTo → 패널 등장 → 지도 폭 변화 → ResizeObserver 재적합 → panTo 중심 이탈의 연쇄 충돌이 났다. 패널 상존(빈 상태)을 고르니 이 연쇄가 발생 자체를 안 함 — 문제를 푸는 게 아니라 문제가 생길 조건을 없애는 선택.
- **선택 로직 단일화**: 좌측 리스트 클릭과 마커 클릭이 handleSelectSpot 하나를 공유 — 리스트가 파생 상태(selectedWork/filteredSpots/selectedSpot)의 소비자로만 붙어 새 상태 0개.
- **규칙이 시안을 이긴 사례**: 시안 눈썹은 11px 실측이나 CLAUDE.md §5 "12px 미만 금지"에 걸려 12px 채택 + 편차 보고. 가독성 하한이 미학보다 우선.
- **grid 자동배치 함정**: 코드만 봐선 안 보이고 모바일 실기동에서만 드러나는 종류(NavLinks 소멸 → 아바타 중앙 흘러감). 검수 모드의 실기동 검증이 밥값 한 지점.
- **번호 체계 재확립**: 이 트랙에서 커밋 3개가 무번호로 쌓여 rebase로 소급 부여 — 이후 "코드 커밋에도 NNNN"(§6 개정)이 정착했고, CC 세션 중간 규칙 개정은 새 세션 시작 시 명시 전달이 필요함을 확인.
