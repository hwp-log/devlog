'use client';

import { usePathname } from 'next/navigation';

// 데스크톱 full-bleed 라우트 — ThemeScope DARK_ROUTES와 동일 패턴, 추가 시 여기 1줄
const FULL_BLEED_ROUTES = ['/spot-finder'];
// 풀폭(max-w 없음) + 패딩 유지 라우트 — 목록 페이지만 정확 매칭(/story/new·/story/[id]·/plan-finder/[id]은 폼·글·상세라 max-w 유지). 3단계
// 0535: 폭 규칙 2원칙 확정 — **고르는 화면(목록·지도)은 풀블리드, 그 외(읽기·입력)는 860**.
//   근거: 입출력은 집중 포커싱이라 좁을수록 피로가 적고, 고르는 화면은 좁으면 후보를 많이 못 본다.
//   /my-plan·/my-story 편입(고르는 화면인데 기본 분기 1232에 갇혀 있었다). 정확 매칭이라
//   /my-plan/[id]·/my-plan/new는 캡 유지. 편입 시 그리드 bp를 wide 전제로 재유도할 것(0532 산출식).
const WIDE_ROUTES = ['/story', '/plan-finder', '/my-plan', '/my-story'];

export function ProtectedMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route));
  const wide = WIDE_ROUTES.includes(pathname);

  return (
    <main
      className={
        fullBleed
          ? 'max-w-none' // 0225: 풀블리드 라우트(SpotFinder)는 전 폭 edge-to-edge — 모바일도 풀스크린 지도. flex-1 미부여(지도 자체 사이징)
          : wide
            ? 'flex-1 px-6 pt-8 pb-24 lg:pb-8' // flex-1: 짧은 콘텐츠에서 푸터를 뷰포트 하단으로(sticky footer). 풀폭 + 헤더와 동일 px-6
            : 'w-full flex-1 max-w-7xl mx-auto px-6 pt-8 pb-24 lg:pb-8' // w-full: flex 부모(ThemeScope flex-col)에서 교차축 auto 마진(mx-auto)이 stretch를 무력화해 fit-content로 수축 → 폭 명시. flex-1: sticky footer
      }
    >
      {children}
    </main>
  );
}
