import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { AppHeader } from '@/app/(protected)/_components/AppHeader';
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
        <AppHeader
          isLoggedIn={!!user}
          email={user?.email ?? ''}
          avatarUrl={profile?.avatarUrl ?? null}
          nickname={profile?.nickname ?? ''}
          isAdmin={profile?.role === 'ADMIN'}
        />
        <ProtectedMain>{children}</ProtectedMain>
        <BottomTabBar />
      </ThemeScope>
    </>
  );
}
