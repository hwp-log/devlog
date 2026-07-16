// Dotrip 디자인 토큰 — 값의 단일 소스.
// 출처: docs/analysis/A005-Dotrip-디자인-확정서.md §2·§3 (역할 이름·다크 확정값·공통값)
//      + 정본 HTML 2종 실측 (라이트 서피스 — --t 기계 생성 이름은 버리고 값만 이관).
// 소비 경로: app/layout.tsx가 buildThemeCss()로 CSS 변수 발행 → globals.css @theme inline이
// Tailwind 유틸(bg-bg, text-fg 등)로 매핑. 값을 다른 파일에 복제하지 말 것.

export const theme = {
  common: {
    primary: '#4d9eff', // 로고 점·눈썹 라벨·활성 칩/탭·채움 버튼·링크. 작품과 무관하게 고정
    accent: '#f0c040', // 별점 전용
    heartActive: '#e24b4a', // 하트 버튼 활성 채움 (A005 §3 ①)
    markerLabel: '#ffb84d', // 0267: 미선택 스팟 라벨 pill 배경 — 다크 지도 웨이파인딩. accent(별점)·works와 역할 분리, CTA 침범 금지
    markerLabelInk: '#2b1d00', // 0267: markerLabel 위 글자 잉크 — 대비 ≈9:1(12px AA 충족). markerLabel 전용
    radius: '10px', // 카드·입력·버튼
  },
  // 마커·작품 배지 한정 — CTA·별점·링크 침범 금지 (A005 §2)
  works: {
    dokkaebi: '#e8476a',
    pachinko: '#ff6b35',
    poksak: '#f0c040',
  },
  light: {
    bgDeep: '#f6f6f8',
    bg: '#ffffff',
    card: '#f2f2f5',
    popover: '#ececf1',
    surface2: '#e8e8ee',
    fg: '#191a1c',
    fg2: '#55565c',
    muted: '#8a8a90',
    border: 'rgba(25,26,28,0.10)',
  },
  dark: {
    bgDeep: '#0f1112',
    bg: '#151718',
    card: '#1d1f21',
    popover: '#232527',
    surface2: '#26292b',
    fg: '#f0eee8',
    fg2: '#c8c4be',
    muted: '#7a7870',
    border: 'rgba(255,255,255,0.08)',
  },
} as const;

export type SurfaceToken = keyof typeof theme.light;

/** 토큰 hex(#rrggbb) → rgba 파생. 글로우 등 알파 변형 전용 — 새 색 정의 금지 (A005 글로우 표기 rgba(77,158,255,~)의 코드 표현) */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** kebab-case 변환: bgDeep → bg-deep, heartActive → heart-active */
function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function toVars(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    // radius는 Tailwind 기본 테마 변수 --radius(bare `rounded` = 0.25rem)와 충돌 방지를 위해 --radius-base로 발행
    .map(([name, value]) => `--${name === 'radius' ? 'radius-base' : kebab(name)}:${value};`)
    .join('');
}

/**
 * CSS 변수 발행: :root = 공통 + 작품색 + 라이트, [data-theme="dark"] = 다크 오버라이드.
 * 화면별 모드 배정(A005 §8)은 레이아웃에 data-theme="dark"를 붙여 스코프한다.
 */
export function buildThemeCss(): string {
  const workVars = Object.entries(theme.works)
    .map(([name, value]) => `--work-${kebab(name)}:${value};`)
    .join('');
  return (
    `:root{${toVars(theme.common)}${workVars}${toVars(theme.light)}}` +
    `[data-theme="dark"]{${toVars(theme.dark)}}`
  );
}
