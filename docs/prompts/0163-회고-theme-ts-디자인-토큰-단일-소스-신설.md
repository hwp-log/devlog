# 0163 회고: theme.ts 디자인 토큰 단일 소스 신설 + Tailwind v4 배선

- **작성일**: 2026-08-10 (소급 작성 — 작업일 2026-07-11)
- **소요 시간**: 약 1시간
- **관련 커밋**: `b0719eb` feat: 0163 디자인 토큰 단일 소스 theme.ts 신설 + Tailwind v4 배선

## 1. 한 줄 요약

A005 확정값과 정본 시안 HTML 실측값을 lib/theme.ts 하나로 모아 색의 단일 소스를 세우고, CSS 변수 발행 + @theme inline 매핑으로 Tailwind 유틸(bg-bg, text-fg 등)까지 배선했다 — 화면 픽셀 변화 0이 합격 기준인 순수 기반 공사.

## 2. 왜 / 목적 / 이유

- **왜(문제)**: 디자인 확정(A005 v3) 후 화면 적용을 시작해야 하는데, 색값이 A005 문서·시안 HTML·기존 하드코딩 세 곳에 흩어져 있었다. 이대로 SpotFinder에 색을 넣으면 하드코딩이 더 늘고, 나중에 토큰을 만들 때 걷어내는 이중 작업이 된다.
- **목적(목표 상태)**: 색의 정본은 theme.ts 한 곳. 화면은 토큰 유틸을 참조만 한다. 이후 모든 디자인 적용 사이클이 이 배선 위에서 돈다.
- **이유(채택 근거)**: 발행 방식은 하이브리드(TS 객체 정본 + buildThemeCss()로 SSR 발행 + @theme inline 이름 매핑) 채택 — 값 복제 없이 CSS와 TS 소비처(지도 마커 inline style)를 모두 지원. 같은 주에 확립한 "단일 소스 + 파생" 원칙을 토큰 계층에 그대로 적용한 것. 시안 HTML의 --t1~--t37 기계 이름은 버리고 값만 이관했다(이름 체계로 못 쓰는 CD 산출물).

## 3. 작성한 프롬프트

```
[배경]
디자인 토큰의 단일 소스로 theme.ts를 신설한다. 명세는 A005 §2·§3,
색값 실측 정본은 시안 HTML 2종 — 단 --t 기계 이름은 버리고 값만 신뢰.
[목표]
1. lib/theme.ts 신설 — 시맨틱 토큰만(primary·bg·fg·heartActive·작품색 3종 등),
   라이트/다크 페어링
2. 라이트 서피스 값 확정 — t변수 사용 문맥을 읽어 역할별 판정, 근거 표 제시
3. 규칙성 토큰(하트 2종 등)은 범위 제외 여부를 plan에서 제안
4. Tailwind v4 연결 방식 제안 — 현 설정 실측 후 판단
[하지 말 것]
❌ 기존 컴포넌트에 토큰 적용(다음 사이클) ❌ --t 이름 이식 ❌ 색 발명
[검수 모드] plan 요청.
```

## 4. 작성·수정한 코드

> ⚠️ 소급 작성 — 커밋 전 CC "읽고 보고만"으로 현재 파일과 대조할 것.

```ts
// lib/theme.ts — 값의 단일 소스 (핵심 구조)
export const theme = {
  common: { primary: '#4d9eff', accent: '#f0c040', heartActive: '#e24b4a', radius: '10px' },
  works: { dokkaebi: '#e8476a', pachinko: '#ff6b35', poksak: '#f0c040' },
  light: { bgDeep: '#f6f6f8', bg: '#ffffff', card: '#f2f2f5', popover: '#ececf1',
           surface2: '#e8e8ee', fg: '#191a1c', fg2: '#55565c', muted: '#8a8a90',
           border: 'rgba(25,26,28,0.10)' },
  dark:  { bgDeep: '#0f1112', bg: '#151718', card: '#1d1f21', popover: '#232527',
           surface2: '#26292b', fg: '#f0eee8', fg2: '#c8c4be', muted: '#7a7870',
           border: 'rgba(255,255,255,0.08)' },
} as const;

export function buildThemeCss(): string {
  // :root = 공통+작품색+라이트, [data-theme="dark"] = 다크 오버라이드
  // radius는 Tailwind 기본 --radius(bare rounded=0.25rem)와 충돌해 --radius-base로 발행
}
```

```css
/* app/globals.css — 이름 참조만 (값 복제 없음) */
@theme inline {
  --color-bg: var(--bg); --color-fg: var(--fg); /* → bg-bg, text-fg 유틸 */
  --radius-card: var(--radius-base);            /* → rounded-card */
}
@custom-variant dark ([data-theme="dark"] &);
```

## 5. 결과 / 배운 점

- **결과**: 발행 실측(curl로 :root 변수 확인) 통과, 전 화면 픽셀 변화 0 육안 확인 후 push. 이후 0164~0169 전부가 이 배선의 소비자가 됐다.
- **radius 함정**: Tailwind 기본 테마에 bare `--radius: 0.25rem`이 이미 있고 기존 코드가 `rounded`를 7곳 사용 — 토큰을 `--radius`로 발행했으면 기존 화면 7곳이 4px→10px로 조용히 변형될 뻔했다. `--radius-base` + `rounded-card`로 우회. plan에 없던 함정을 검수 모드가 잡은 사례.
- **라이트 값 판정 방법론**: 다크 폴백이 A005 확정값과 1:1 일치하는 t변수를 앵커로 삼아 라이트 페어를 역산 — 발명 없이 실측만으로 빈칸을 채우는 리듬을 확립했다.
- **번호 체계 교훈**: 이 커밋이 처음엔 무번호로 push됐고, "코드 커밋에도 NNNN 부여"로 §6을 개정하며 amend + force push로 소급 부여했다. 회고는 당시 생략(준비성 작업 판정)했다가 프로토타입 완성 후 소급 작성 — 결번은 남기지 않는다.
