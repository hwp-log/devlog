'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// 2단(라이트/다크) 고정: enableSystem={false} + defaultTheme="light" = prefers-color-scheme 미참조(0282 결정 유지).
// attribute="data-theme" = 라이브러리 기본값이지만 buildThemeCss([data-theme=dark], lib/theme.ts)와의 페어를 명시.
// storageKey "dotrip-theme" = localhost 공유 origin에서 타 프로젝트의 "theme" 키와 충돌 회피.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      storageKey="dotrip-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
