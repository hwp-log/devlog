'use client';

import { usePathname } from 'next/navigation';

// 데스크톱 full-bleed 라우트 — ThemeScope DARK_ROUTES와 동일 패턴, 추가 시 여기 1줄
const FULL_BLEED_ROUTES = ['/spot-finder'];

export function ProtectedMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <main
      className={
        fullBleed
          ? 'max-w-none' // 0225: 풀블리드 라우트(SpotFinder)는 전 폭 edge-to-edge — 모바일도 풀스크린 지도
          : 'max-w-7xl mx-auto px-6 pt-8 pb-24 lg:pb-8'
      }
    >
      {children}
    </main>
  );
}
