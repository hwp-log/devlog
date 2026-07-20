'use client';

import { usePathname } from 'next/navigation';

// 데스크톱 full-bleed 라우트 — ThemeScope DARK_ROUTES와 동일 패턴, 추가 시 여기 1줄
const FULL_BLEED_ROUTES = ['/spot-finder'];
// 풀폭(max-w 없음) + 패딩 유지 라우트 — 목록 페이지만 정확 매칭(/story/new·/story/[id]은 폼·글이라 max-w 유지). 3단계
const WIDE_ROUTES = ['/story'];

export function ProtectedMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route));
  const wide = WIDE_ROUTES.includes(pathname);

  return (
    <main
      className={
        fullBleed
          ? 'max-w-none' // 0225: 풀블리드 라우트(SpotFinder)는 전 폭 edge-to-edge — 모바일도 풀스크린 지도
          : wide
            ? 'px-6 pt-8 pb-24 lg:pb-8' // 풀폭 + 헤더와 동일 px-6 (max-w 없음). 뷰포트 단위 미사용 → 가로 스크롤 무관
            : 'max-w-7xl mx-auto px-6 pt-8 pb-24 lg:pb-8'
      }
    >
      {children}
    </main>
  );
}
