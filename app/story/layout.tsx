import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { NavLinks } from '@/app/(protected)/_components/NavLinks';
import { LogoutButton } from '@/app/(protected)/_components/LogoutButton';
import { signOut } from '@/lib/auth/actions';

export default async function StoryLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initial = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <header className="sticky top-0 z-10 glass-header">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/story" className="text-lg font-bold text-[#1A1A1A]">Dotrip</Link>
          <div className="flex items-center gap-6">
            {user ? (
              <>
                <NavLinks />
                <Link href="/story/new" className="bg-[#1A1A1A] text-white px-4 py-1.5 rounded-full text-sm">
                  + 스토리
                </Link>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-medium">
                    {initial}
                  </div>
                  <span className="text-sm text-slate-600">{user.email}</span>
                </div>
                <LogoutButton action={signOut} />
              </>
            ) : (
              <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
