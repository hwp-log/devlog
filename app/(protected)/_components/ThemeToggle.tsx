'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

// 드롭다운 메뉴 항목형 테마 토글. useTheme 반환값은 서버에서 undefined라 렌더에 쓰면
// 하이드레이션 미스매치 — 두 상태를 모두 렌더하고 표시는 dark: variant(CSS)가 전환,
// useTheme은 onClick(마운트 후 실행)에서만 소비한다. 마크업이 테마 무관 = 미스매치 구조적 부재.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function handleToggle() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    // [v1.0+] 계정 저장 훅 자리: 로그인 사용자면 여기서 Server Action으로 서버 동기화
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleToggle}
      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-fg2 hover:bg-slate-50 dark:hover:bg-surface2 transition-colors duration-150"
    >
      <span className="flex items-center gap-2 dark:hidden">
        <Moon size={14} /> 다크 모드
      </span>
      <span className="hidden items-center gap-2 dark:flex">
        <Sun size={14} /> 라이트 모드
      </span>
    </button>
  );
}
