'use client';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';
import { getAvatarInfo } from '@/lib/avatar/generate';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  email: string;
  avatarUrl: string | null;
  nickname: string;
  isAdmin: boolean;
}

export function UserDropdown({ email, avatarUrl, nickname, isAdmin }: Props) {
  const { initial, color } = getAvatarInfo(nickname);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center hover:opacity-90 transition-opacity"
        style={avatarUrl ? undefined : { backgroundColor: color }}
        aria-label="사용자 메뉴"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-white select-none">{initial}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="사용자 메뉴"
          className="absolute right-0 top-10 w-52 bg-white dark:bg-popover rounded-lg shadow-lg border border-slate-200 dark:border-border py-1 z-50"
        >
          <p className="px-4 py-2 text-xs text-slate-500 dark:text-muted truncate">{email}</p>
          <hr className="border-slate-100 dark:border-border my-1" />
          <Link
            href="/mypage"
            role="menuitem"
            className="block px-4 py-2 text-sm text-slate-700 dark:text-fg2 hover:bg-slate-50 dark:hover:bg-surface2 transition-colors duration-150"
            onClick={() => setOpen(false)}
          >
            MyPage
          </Link>
          {/* 0546: MyStory → MyPlan 순 — 상단 내비(NavLinks: Story → SpotFinder → PlanFinder)와
              내 화면 축을 같은 순서로 동조(두 메뉴가 한 벌로 읽히게) */}
          <Link
            href="/my-story"
            role="menuitem"
            className="block px-4 py-2 text-sm text-slate-700 dark:text-fg2 hover:bg-slate-50 dark:hover:bg-surface2 transition-colors duration-150"
            onClick={() => setOpen(false)}
          >
            MyStory
          </Link>
          <Link
            href="/my-plan"
            role="menuitem"
            className="block px-4 py-2 text-sm text-slate-700 dark:text-fg2 hover:bg-slate-50 dark:hover:bg-surface2 transition-colors duration-150"
            onClick={() => setOpen(false)}
          >
            MyPlan
          </Link>
          {/* Admin은 이동 그룹에 편입(0482 3구역 재구성) — 선행 구분선 제거해 MyStory와 한 그룹.
              항목·순서 불변, 구분선만 재배치 */}
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              className="block px-4 py-2 text-sm text-slate-700 dark:text-fg2 hover:bg-slate-50 dark:hover:bg-surface2 transition-colors duration-150"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          )}
          {/* 설정 구역(0482) — 헤더에서 이전한 테마 토글 자리(설정 항목 확장 대비).
              행은 div(menuitem 아님) — 그 자리 조작이라 닫힘 로직 제외. ThemeToggle이
              setOpen을 안 부르고 컨테이너 ref 안이라 눌러도 드롭다운 유지(요구 3).
              좌 Moon = 기능 아이콘 / 우 스위치 = 현재 상태(iOS 설정 행 관례) */}
          <hr className="border-slate-100 dark:border-border my-1" />
          <div className="flex items-center justify-between px-4 py-2">
            <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-fg2">
              <Moon size={16} /> 다크 모드
            </span>
            <ThemeToggle />
          </div>
          <hr className="border-slate-100 dark:border-border my-1" />
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-surface2 transition-colors duration-150"
            >
              SignOut
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
