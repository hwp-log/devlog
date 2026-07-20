import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { AppHeader } from '@/app/(protected)/_components/AppHeader';
import { BottomTabBar } from '@/app/(protected)/_components/BottomTabBar';

export default async function StoryLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { nickname: true, avatarUrl: true, role: true },
      })
    : null;

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <AppHeader
        isLoggedIn={!!user}
        email={user?.email ?? ''}
        avatarUrl={profile?.avatarUrl ?? null}
        nickname={profile?.nickname ?? ''}
        isAdmin={profile?.role === 'ADMIN'}
        widthClassName="max-w-7xl mx-auto"
      />
      <main className="max-w-7xl mx-auto px-6 pt-8 pb-24 lg:pb-8">
        {children}
      </main>
      {user && <BottomTabBar />}
    </div>
  );
}
