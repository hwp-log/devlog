import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Logo } from '@/app/(protected)/_components/Logo';
import { NavLinks } from '@/app/(protected)/_components/NavLinks';
import { UserDropdown } from '@/app/(protected)/_components/UserDropdown';
import { BottomTabBar } from '@/app/(protected)/_components/BottomTabBar';
import { HeaderGate } from '@/app/(protected)/_components/HeaderGate';
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
        <HeaderGate>
        <header className="sticky top-0 z-10 glass-header">
          <div className="px-6 h-14 grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="justify-self-start">
              <Logo />
            </div>
            <NavLinks />
            {/* col-start-3 명시 — 모바일에서 NavLinks(display:none) 소멸 시 중앙 열로 자동 배치되는 것 방지 */}
            <div className="col-start-3 justify-self-end flex items-center gap-3">
              <Link
                href="/story/new"
                className="hidden lg:inline-flex items-center rounded-full bg-primary px-[17px] py-[7px] text-[12.5px] font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                Write
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
        </HeaderGate>
        <ProtectedMain>{children}</ProtectedMain>
        <BottomTabBar />
      </ThemeScope>
    </>
  );
}
