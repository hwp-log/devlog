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
          ? 'max-w-7xl mx-auto px-6 pt-8 pb-24 md:max-w-none md:px-0 md:pt-0 md:pb-0'
          : 'max-w-7xl mx-auto px-6 pt-8 pb-24 md:pb-8'
      }
    >
      {children}
    </main>
  );
}
