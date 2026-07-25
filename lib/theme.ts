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
    // 0337: 무채 채움 스케일 — 서피스(배경)와 별도. 눈썹 텍스트·비인터랙션 아이콘·예산 트리맵 타일 채움용.
    // 서피스는 r=g 무채(surface2 232,232,238)지만 fill은 r<g<b로 브랜드 파랑(primary)에 살짝 기운 저채도.
    // 라이트: fill1 가장 옅음 → fill5 가장 진함. 차트 면적 대비 확보용으로 서피스보다 넓게 스팬.
    fill1: '#e2e6ee',
    fill2: '#c4cbd8',
    fill3: '#9aa3b5',
    fill4: '#6b7488',
    fill5: '#444b5c',
    // 0343: 차트 rank 팔레트 — 예산 트리맵 타일. rank1=비중 최대 항목. Bg(타일 배경)·Fg(타일 글자)는
    // 짝으로만 사용 — chartNBg 위엔 반드시 chartNFg (섞으면 대비 미보장). rank6+(최대 6항목)는 rank5 재사용.
    chart1Bg: '#a9cdf0',
    chart1Fg: '#1f3a52',
    chart2Bg: '#f4e0a3',
    chart2Fg: '#5a4a1a',
    chart3Bg: '#a9dcc0',
    chart3Fg: '#1f4636',
    chart4Bg: '#f3c2cf',
    chart4Fg: '#5a2733',
    chart5Bg: '#cbc0ec',
    chart5Fg: '#352a55',
    // 0290: hover 라이트 — card에서 한 톤 진한 회색 평면(hi=lo)·무테두리·글씨 fg2 유지(명도 반응은 배경 담당).
    // 알약 본체 색·그림자는 0292부터 markerContent(isDark) JS 분기가 담당 — 여기는 hover(globals.css 소비)만.
    markerHoverHi: '#e8e8ee',
    markerHoverLo: '#e8e8ee',
    markerHoverBorder: 'transparent',
    markerHoverFg: '#55565c',
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
    // 0337: 무채 채움 스케일 다크 — 명도 반전(fill1 가장 진함 → fill5 가장 밝음), 채도는 라이트보다 더 낮춤.
    // fill1은 bgDeep(#0f1112, 15,17,18)보다 명확히 밝아 배경에 묻히지 않게 띄움.
    fill1: '#24282e',
    fill2: '#343943',
    fill3: '#4d545f',
    fill4: '#6f7884',
    fill5: '#9aa1ab',
    // 0343: 차트 rank 팔레트 다크 — 라이트와 같은 rank 순서·짝 규칙(chartNBg ↔ chartNFg)
    chart1Bg: '#5b86ad',
    chart1Fg: '#eaf3fb',
    chart2Bg: '#b39c54',
    chart2Fg: '#faf3d8',
    chart3Bg: '#5aa584',
    chart3Fg: '#e6f5ec',
    chart4Bg: '#b06e81',
    chart4Fg: '#fbe8ee',
    chart5Bg: '#8579b3',
    chart5Fg: '#efeafb',
    // 0270 hover 확정값 그대로(#454b52 = 평상 pill 각 스톱 한 톤 상향). 알약 본체의 다크 확정값(0269 리터럴)은
    // 0292부터 markerContent(isDark) 분기 안에 직접 존재 — 여기는 hover(globals.css .marker-hover 소비)만.
    markerHoverHi: '#454b52',
    markerHoverLo: '#33383d',
    markerHoverBorder: 'rgba(255,255,255,0.8)',
    markerHoverFg: '#e5e7eb',
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
