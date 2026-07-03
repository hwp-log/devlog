'use client';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from '@/lib/auth/actions';
import { getAvatarInfo } from '@/lib/avatar/generate';

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
          className="absolute right-0 top-10 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50"
        >
          <p className="px-4 py-2 text-xs text-slate-500 truncate">{email}</p>
          <hr className="border-slate-100 my-1" />
          <Link
            href="/mypage"
            role="menuitem"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            onClick={() => setOpen(false)}
          >
            MyPage
          </Link>
          <Link
            href="/my-plan"
            role="menuitem"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            onClick={() => setOpen(false)}
          >
            MyPlan
          </Link>
          <Link
            href="/my-dots"
            role="menuitem"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            onClick={() => setOpen(false)}
          >
            MyStory
          </Link>
          {isAdmin && (
            <>
              <hr className="border-slate-100 my-1" />
              <Link
                href="/admin"
                role="menuitem"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-150"
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            </>
          )}
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 transition-colors duration-150"
            >
              SignOut
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
