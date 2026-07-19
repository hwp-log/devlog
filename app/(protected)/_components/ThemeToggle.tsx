'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

// 0293: 헤더 트랙 스위치 (업계 표준 헤더 패턴) — 드롭다운 메뉴 항목(0283)에서 이전.
// 로직은 next-themes 그대로(storageKey·attribute 무변). 렌더는 테마 무관 마크업 +
// dark: variant CSS 분기(0283 원칙 — useTheme 렌더 사용 금지, 마운트 가드 불필요)라 하이드레이션 안전.
// 트랙 52×28·knob 24(이동 거리 = 52−24−2×2 = 24px). 라이트 = surface2 회색·knob 왼쪽+해,
// 다크 = primary 파랑·knob 오른쪽+달. transition 250ms ease(트랙 색·knob transform).
// 히트 영역: 시각 52×28은 §5(44px) 미달 → before 의사요소 -inset-2로 68×44 확보(레이아웃 무영향).
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function handleToggle() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    // [v1.0+] 계정 저장 훅 자리: 로그인 사용자면 여기서 Server Action으로 서버 동기화
  }

  return (
    <button
      type="button"
      aria-label="테마 전환"
      onClick={handleToggle}
      className="relative h-[28px] w-[52px] shrink-0 rounded-full bg-surface2 dark:bg-primary transition-colors duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] before:absolute before:-inset-2 before:content-['']"
    >
      <span
        aria-hidden
        className="absolute left-[2px] top-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] dark:translate-x-6"
      >
        <Sun size={14} className="text-fg2 dark:hidden" />
        <Moon size={14} className="hidden text-primary dark:block" />
      </span>
    </button>
  );
}
