'use client';
import { usePathname } from 'next/navigation';

// A005 §8 화면별 모드 배정표의 유일한 코드 표현 — 다크 화면 추가 시 여기에 1줄
const DARK_ROUTES = ['/spot-finder'];

export function ThemeScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const dark = DARK_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div
      data-theme={dark ? 'dark' : undefined}
      className={`min-h-screen${dark ? ' bg-bg-deep' : ''}`}
      style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
    >
      {children}
    </div>
  );
}
