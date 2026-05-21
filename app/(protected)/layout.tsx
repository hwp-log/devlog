import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/app/(protected)/dashboard/LogoutButton';
import { signOutAction } from '@/app/(protected)/dashboard/actions';
import { NavLinks } from '@/app/(protected)/_components/NavLinks';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initial = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <div
        className="min-h-screen bg-slate-50"
        style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
      >
        <header className="sticky top-0 z-10 glass-header">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/dashboard" className="text-lg font-bold text-[#1A1A1A]">Dotrip</Link>
            <div className="flex items-center gap-6">
              <NavLinks />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-medium">
                  {initial}
                </div>
                <span className="text-sm text-slate-600">{user?.email}</span>
              </div>
              <LogoutButton action={signOutAction} />
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </>
  );
}
