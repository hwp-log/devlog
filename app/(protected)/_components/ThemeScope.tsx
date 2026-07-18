'use client';
import { usePathname } from 'next/navigation';

// A005 §8 화면별 모드 배정표의 유일한 코드 표현 — 다크 화면 추가 시 여기에 1줄.
// 0284: '/spot-finder' 해제 — 테마 토글 편입(멘토 피드백 결정). 전 화면이 루트 토글(0283)을 따름.
const DARK_ROUTES: string[] = [];

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
