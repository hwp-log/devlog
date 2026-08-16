// Dotrip 디자인 토큰 — 값의 단일 소스.
// 출처: docs/analysis/A005-Dotrip-디자인-확정서.md §2·§3 (역할 이름·다크 확정값·공통값)
//      + 정본 HTML 2종 실측 (라이트 서피스 — --t 기계 생성 이름은 버리고 값만 이관).
// 소비 경로: app/layout.tsx가 buildThemeCss()로 CSS 변수 발행 → globals.css @theme inline이
// Tailwind 유틸(bg-bg, text-fg 등)로 매핑. 값을 다른 파일에 복제하지 말 것.

export const theme = {
  common: {
    primary: '#4d9eff', // 로고 점·눈썹 라벨·활성 칩/탭·채움 버튼·링크. 작품과 무관하게 고정
    // 0524: primary 면 위 글자 — 흰 글자는 대비 2.74:1로 WCAG AA(4.5) 미달이었다.
    // #0b1a2b = 6.39:1. primary가 common(모드 공용)이라 결함도 모드 무관 → 라이트·다크 한 값.
    primaryFg: '#0b1a2b',
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
    // 0477: 파괴(danger) 축 — 버튼 격자 3(강조)×2(위험)의 위험 열 전용.
    // 라이트는 기존 리터럴(red-500/200/50) 등가 이관 — 시각 무변.
    // danger=텍스트·아이콘 / dangerBorder=테두리 / dangerSurface=hover 면 세트로만 사용
    danger: '#ef4444',
    dangerBorder: '#fecaca',
    dangerSurface: '#fef2f2',
    // 0478→0479: 파괴 채움(흰 글씨 전제). red-600(4.83:1)이 실화면에서 과강렬해 red-500으로
    // 완화 — 흰 글씨 3.76:1로 AA(4.5) 미달을 **알고 수용**(0479 사용자 확정): 라이트 danger
    // 텍스트가 이미 3.08:1 미달 유지(0477 판정)인 것과 같은 결이고, 삭제는 저빈도이며
    // 색·아이콘·위치로 식별된다. hover는 한 톤 진하게 red-600(4.83:1 — hover 상태는 충족)
    dangerFill: '#ef4444',
    dangerFillHover: '#dc2626',
    // 0580: 경고 축 — 텍스트·아이콘 한 축만(테두리·면 없음. 안 쓰는 토큰을 미리 만들면 값의
    // 근거가 실측 없이 남는다). danger와 분리하는 이유: 파괴는 "되돌릴 수 없다"의 색이고
    // 경고는 "값이 지금과 다를 수 있다"의 색이라 층위가 다르다.
    //
    // 0589: amber-700(#b45309, 5.01:1) → amber-600. **실화면에서 회색으로 읽혀 기각됐다.**
    // 원인은 채도가 아니라 명도다: amber-700은 채도 90%인데 명도가 37.1%라 본문 회색
    // fg2(34.7%)와 거의 같았고, 어두운 색은 눈이 hue를 분간하지 못한다 — 13px 텍스트와
    // 1.5px 선폭 아이콘에서는 그냥 갈색 회색이 된다. amber-600은 명도 43.7%로 fg2와의 간격이
    // 2.4pp → 9.0pp로 벌어진다(danger 60.2%에는 여전히 못 미치지만 hue가 읽히는 구간).
    // **4.5를 지켜 회색으로 읽히는 것보다 3.19인데 경고로 읽히는 쪽이 목적에 맞다** —
    // 대비 기준은 "읽히게 하려고" 있는 것이고, 여기서는 그 기준을 지킨 값이 오히려 안 읽혔다.
    // 라이트 danger가 3.08:1 미달을 알고 수용한 것(0477)과 같은 기준이다.
    // 0580이 "이건 읽으라고 쓰는 문장이라 대비를 지킨다"고 판단했던 것은 이 실측으로 뒤집혔다.
    // 획 보강을 짝으로 둔다(0589): 문구는 font-medium, 아이콘 14 → 16px — 획이 굵어지면
    // 같은 색도 색으로 읽힌다. **값만 바꾸고 굵기를 되돌리면 판정이 다시 흔들린다.**
    // hue 32° — danger 0°·accent 45°(별점 전용)·catFlight(파스텔 노랑)와 갈린다.
    warning: '#d97706',
    // 0345: 짧은 선분(세로 구분선) 전용 — border는 긴 수평선용 헤어라인이라 1px 세로 조각에선
    // 식별 불가(대비 1.23:1 실측). 시안 청회색 hue(130,150,180) 유지 + 알파 상향 → 대비 1.48:1.
    // 면 채움에 쓰지 않음(면은 fill 스케일 소관).
    divider: 'rgba(130,150,180,0.40)',
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
    // ── 0524: 플랜파인더 상세 다크 정돈용. 라이트 값은 전부 기존 하드코딩 렌더값 그대로(무변).
    // 비용 카테고리 고정색(0517) — 누적 막대와 이름 옆 3px 막대가 이 한 벌을 공유.
    // 라이트 파스텔은 다크 배경(#151718)에서 대비 1.5~1.7:1로 묻혀 다크만 채도·명도를 올린다.
    catTransport: '#a8c7f0',
    catFlight: '#f2d9a0',
    catFood: '#c9b8ea',
    catAccommodation: '#f4b8bd',
    catEntrance: '#bcd0da',
    catEtc: '#a9dfc4',
    // 0564: 주차비 — 7번째 색. 기존 6색 hue(교통213·입장료200·기타152·항공41·숙박355·식비262)에서
    //   41→152 사이 111°가 유일한 큰 공백이라 그 중앙(95° 라임)을 잡았다. 나머지 인접 간격
    //   46~49°와 동형. 색차 검산(CIEDE2000, 기존 6색 중 최근접): 라이트 12.5(항공) — 기존 6색끼리의
    //   최소값 10.7(교통/입장료, 이미 붙어도 갈린다고 확정된 쌍)을 상회.
    catParking: '#cfe0a2',
    // 행 구분선(1px) / 섹션 2px 밑줄 — 위계는 굵기가 아니라 밝기가 만든다.
    hairline: '#f1f2f3',
    sectionRule: '#191a1c',
    // 작품 칩 — 다크는 옅은 파랑 면을 못 써 면·글자를 반전(대비 6.89:1).
    chipMovieBg: '#eaf3ff',
    chipMovieFg: '#2f7fe0',
    // 금액 위계 3단(크기 차 26/14에 밝기 차를 더함): 총액 > 항목 금액 > 카테고리 이름.
    costTotal: '#191a1c',
    costAmount: '#191a1c',
    costLabel: '#55565c',
    // 히어로 커버 위 제목 가독 — 하단 그라디언트 + 사진 전체 베일(라이트는 베일 없음).
    heroScrim: 'rgba(10,12,13,0.72)',
    heroVeil: 'transparent',
    // ── 0527: 작성 화면(플랜 새로/수정) 조판용.
    // 입력 테두리 — border 토큰(rgba(255,255,255,.08))은 다크 입력에서 너무 옅어 터치 경계가
    // 안 읽힌다. 입력 경계는 별도 축으로 둔다.
    fieldBorder: '#dfe2e4',
    // muted보다 한 단 옅은 층 — placeholder·빈 상태 설명·0원처럼 "아직 값이 없음" 표시 전용.
    hint: '#b3b9bd',
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
    // 0477: 파괴 축 다크 — red-500은 다크 surface2 대비 3.89:1(소형 텍스트 미달)이라
    // red-400(#f87171, 5.29:1)로 승급. 테두리는 알파 대신 솔리드(다크 divider 0345 전례 —
    // 알파는 흐릿) surface2 대비 1.46:1(divider 1.48 동급). hover 면은 red-50(백색 근접)이
    // 다크에서 튀므로 surface2 대비 1.03:1 미세 상향 + 적색 틴트(기존 hover 진폭과 동일)
    danger: '#f87171',
    dangerBorder: '#6b3030',
    dangerSurface: '#3a2626',
    // 0478: 파괴 채움 다크 — red-600은 다크에서 과열이라 red-700(#b91c1c, 흰 글씨 6.47:1·
    // surface2 대비 2.26:1)으로 낮추고, hover는 한 톤 상향(red-600, 4.83:1 — 0270 마커
    // hover의 다크 상향 관례와 같은 방향). 네 값 모두 흰 글씨 4.5:1 이상
    dangerFill: '#b91c1c',
    dangerFillHover: '#dc2626',
    // 0580: 경고 축 다크 — 라이트보다 밝게(다크 danger의 red-500→red-400 승급과 같은 방향, 0477).
    // amber-500 = bg(#151718) 대비 8.37:1(0589 재실측 — 구 주석 8.46은 반올림 오차). amber-400(#fbbf24)은 accent(#f0c040, 별점 전용)와
    // 너무 붙어 한 단 낮췄다 — 별점이 이 화면에 없어 실충돌은 없지만 색 언어는 갈라 둔다.
    // 0589: 라이트가 amber-700 → amber-600으로 밝아졌지만 **다크는 무변**이다 — 명도 50.3%로
    // 애초에 회색으로 읽히는 문제가 없었다(라이트 기각 사유가 여기엔 해당하지 않음).
    // 결과적으로 라이트·다크가 amber-600/500으로 한 단 차이가 됐다(구 700/500 두 단에서).
    warning: '#f59e0b',
    // 0345: 구분선 다크 — 라이트와 같은 hue(채도 상향은 파랑=상호작용 규칙과 혼동이라 알파로만 조정).
    // 알파 상향(0.28~0.75, ≤3.90:1)으로도 실화면 흐릿 → 베이스 자체를 밝힌 솔리드로 전환.
    // #96a8bd 대비 7.39:1 (bg #151718) — 아이콘 fg2(10.36:1)보다는 아래. hue는 청회색 유지.
    divider: '#96a8bd',
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
    // ── 0524: 라이트 짝과 같은 이름·다른 값. 대비는 배경 bg(#151718) 기준 실측.
    catTransport: '#6ea8f0', // 7.30:1
    catFlight: '#e3b45c', // 9.38:1
    catFood: '#a98ae8', // 6.41:1
    catAccommodation: '#ef8592', // 7.23:1
    catEntrance: '#7fb0c4', // 7.63:1
    catEtc: '#57c894', // 8.65:1
    catParking: '#a8c85f', // 9.50:1 — 색차 최근접 17.5(기타), 다크 6색 최소값 12.1 상회
    hairline: '#212426', // 배경 대비 명도 +4%(1.15:1) — 보이되 튀지 않는 선
    sectionRule: '#e7eaec', // 2px 밑줄은 밝게 남겨 섹션 위계를 밝기로 표현
    chipMovieBg: '#16324f',
    chipMovieFg: '#8cc0fb', // 칩 면 대비 6.89:1
    costTotal: '#f2f4f5', // 16.30:1
    costAmount: '#b9bfc4', // 9.69:1
    costLabel: '#8b9196', // 5.64:1
    heroScrim: 'rgba(10,12,13,0.92)',
    heroVeil: 'rgba(10,12,13,0.18)',
    // ── 0527: 라이트 짝과 같은 이름·다른 값(시안 6b·6d 실측)
    fieldBorder: '#2f3336',
    hint: '#6f7579',
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
