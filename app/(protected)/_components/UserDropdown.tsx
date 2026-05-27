'use client';
import { useRef, useEffect, useState } from 'react';
import { User } from 'lucide-react';
import Link from 'next/link';
import { signOut } from '@/lib/auth/actions';

interface Props {
  email: string;
}

export function UserDropdown({ email }: Props) {
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
        className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 transition-colors"
        aria-label="사용자 메뉴"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User className="w-4 h-4 text-slate-600" />
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
            href="/my-dots"
            role="menuitem"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            MyPage
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
