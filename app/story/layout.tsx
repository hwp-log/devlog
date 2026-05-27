import Link from 'next/link';
import { PenSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { NavLinks } from '@/app/(protected)/_components/NavLinks';
import { UserDropdown } from '@/app/(protected)/_components/UserDropdown';

export default async function StoryLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <header className="sticky top-0 z-10 glass-header">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/story" className="text-lg font-bold text-[#1A1A1A]">Dotrip</Link>
          <div className="flex items-center gap-6">
            {user ? (
              <>
                <NavLinks />
                <Link
                  href="/story/new"
                  className="flex items-center gap-1.5 bg-white text-slate-600 border border-slate-300 px-4 py-1.5 rounded-full text-sm hover:bg-slate-50 transition-colors"
                >
                  <PenSquare size={14} />
                  Write
                </Link>
                <UserDropdown email={user.email ?? ''} />
              </>
            ) : (
              <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
