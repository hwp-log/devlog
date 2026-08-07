import type { ReactNode } from 'react';

/**
 * 섹션 헤더 — 22px/700 제목 + 2px 실선 + 같은 줄 우측 보조.
 *
 * ── 산출 근거 (0531 추출) ────────────────────────────────────────────────
 * 조사 시점 4벌이 존재했고 골격(`flex items-baseline justify-between gap-3`
 * + `border-b-2 border-section-rule pb-2 sm:pb-2.5` + 제목 `sm:text-[22px]
 * font-bold tracking-[-0.02em] text-fg break-keep`)은 완전히 일치했다.
 *   1. MyPlanNewForm.tsx  로컬 SectionHeader (0527)
 *   2. PlanFinderDetail.tsx 로컬 SectionHeader (0516/0522/0524)
 *   3. mypage/ActivityDashboardCard.tsx 인라인 (0529)
 *   4. mypage/RecentActivityCard.tsx     인라인 (0529)
 *
 * 상수(lib/button-styles.ts)가 아니라 컴포넌트인 이유: 버튼은 button·label·
 * submit·ref·onMouseDown으로 호출부 시그니처가 제각각이라 클래스 상수가
 * 맞았지만, 이 조각은 4벌 전부 `<div><h2>{title}</h2>{sub}</div>` 동일 DOM이다.
 *
 * 위치가 app/(protected)/_components 인 이유: 사용처 5화면(MyPlan·PlanFinder·
 * MyPage·MyStory·Admin)이 전부 (protected) 그룹 안이고, 이 디렉토리가 이미
 * AppHeader·Footer·Pagination 같은 그룹 공용 UI를 담는다. components/ 루트는
 * 스팟 도메인(SpotMap·SpotPopup…) 몫. 스팟파인더 사이드에서 쓸 일이 생겨도
 * components/SpotFinderMapNaver.tsx가 이미 이 디렉토리의 ThemeToggle을
 * import하는 선례가 있어 방향 문제 없음.
 *
 * ── 갈렸던 값과 통일 판정 ─────────────────────────────────────────────────
 * ① 모바일 제목 19px(PlanFinderDetail) vs 20px(나머지 3벌) → **20px 채택**.
 *    다수(3:1)이고 §5(12px 하한)와 무관한 값이라 실측 판정이 아닌 시점 차로
 *    본다. 적용 사이클에 PlanFinderDetail만 모바일 1px 커진다 — 알고 받는 값.
 * ② 보조 정렬: MyPlanNewForm만 `text-right`, 나머지는 `shrink-0`만.
 *    → **shrink-0 + text-right 채택**. 한 줄일 땐 시각 동일하고, 2줄로 접힐
 *    때 우측 정렬이 실선 끝과 맞는다.
 * ③ 위여백: MyPlanNewForm만 mt를 컴포넌트 안에 내장(first prop으로 분기)했고
 *    나머지 3벌은 호출부 래퍼가 담당. → **prop으로 받지 않는다**. 여백은 섹션
 *    간 조판이라 호출부 책임이고, prop으로 받으면 화면마다 다른 mt가 이 파일에
 *    쌓인다(0518 "variant로 조판 두 벌" 재발 경로).
 *
 * ── 이 컴포넌트가 담당하지 않는 것 ────────────────────────────────────────
 * - 2px 실선 없는 22px h2 (story/[id] 본문 소제목, globals.css .tiptap-content
 *   h1/h2 규칙 0523) — 같은 크기지만 다른 물건. 섹션을 가르는 장치가 아니다.
 * - 지표 밴드(라벨 12px 위 / 값 20px 아래 / 위아래 실선). PlanFinderDetail과
 *   ActivityDashboardCard에 1벌씩 있으나 라벨 11 vs 12px·값 bold vs normal이
 *   각각 0512·0529의 살아있는 판정이라 합병 불가. 11px은 §5 위반이라 통일하려면
 *   시각이 변한다 → 접근성 결함 정리 사이클(작품 칩 11px·태그 칩 12.5px과 같은
 *   묶음)에서 bold/normal 판정과 함께 처리.
 */
export function SectionHeader({
  title,
  // 0529 ActivityDashboardCard가 보조에 반응형 스왑(`누적` / `가입 이후 누적`)을
  // 넣으므로 string이 아니라 ReactNode.
  sub,
  // MyPlanNewForm "항공편 예상" 1곳 전용 — 제목 안 보조어. 조판을 두 벌로
  // 가르는 variant가 아니라 선택적 자식이라 prop으로 둔다.
  badge,
}: {
  title: string;
  sub?: ReactNode;
  badge?: string;
}) {
  return (
    // 0524: 2px 밑줄은 hairline보다 밝게(다크 #e7eaec) — 위계를 굵기가 아니라 밝기가 만든다
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-section-rule pb-2 sm:pb-2.5">
      <h2 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.02em] text-fg break-keep">
        {title}
        {badge && <span className="ml-1.5 text-xs sm:text-sm font-medium text-muted">{badge}</span>}
      </h2>
      {sub && <span className="text-xs sm:text-sm text-muted shrink-0 text-right">{sub}</span>}
    </div>
  );
}
