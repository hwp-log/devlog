import Link from 'next/link';
import { PenSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Logo } from '@/app/(protected)/_components/Logo';
import { NavLinks } from '@/app/(protected)/_components/NavLinks';
import { UserDropdown } from '@/app/(protected)/_components/UserDropdown';
import { BottomTabBar } from '@/app/(protected)/_components/BottomTabBar';
import { ThemeScope } from '@/app/(protected)/_components/ThemeScope';
import { ProtectedMain } from '@/app/(protected)/_components/ProtectedMain';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { nickname: true, avatarUrl: true, role: true },
      })
    : null;

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <ThemeScope>
        <header className="sticky top-0 z-10 glass-header">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-6">
              <NavLinks />
              <Link
                href="/story/new"
                className="hidden md:flex btn-soft items-center px-4 py-1.5 text-slate-600 dark:text-fg2 text-sm"
              >
                <span className="relative z-[2] flex items-center gap-1.5">
                  <PenSquare size={14} />
                  Write
                </span>
              </Link>
              <UserDropdown
                email={user?.email ?? ''}
                avatarUrl={profile?.avatarUrl ?? null}
                nickname={profile?.nickname ?? ''}
                isAdmin={profile?.role === 'ADMIN'}
              />
            </div>
          </div>
        </header>
        <ProtectedMain>{children}</ProtectedMain>
        <BottomTabBar />
      </ThemeScope>
    </>
  );
}
