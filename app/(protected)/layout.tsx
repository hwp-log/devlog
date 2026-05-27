import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { NavLinks } from '@/app/(protected)/_components/NavLinks';
import { UserDropdown } from '@/app/(protected)/_components/UserDropdown';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <div
        className="min-h-screen"
        style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
      >
        <header className="sticky top-0 z-10 glass-header">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/story" className="text-lg font-bold text-[#1A1A1A]">Dotrip</Link>
            <div className="flex items-center gap-6">
              <NavLinks />
              <UserDropdown email={user?.email ?? ''} />
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
