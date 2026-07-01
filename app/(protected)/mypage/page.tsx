import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';
import { AvatarForm } from './AvatarForm';
import { NicknameForm } from './NicknameForm';
import { PasswordForm } from './PasswordForm';
import { ActivityDashboardCard } from './ActivityDashboardCard';
import { DangerZoneCard } from './DangerZoneCard';
import { RecentActivityCard } from './RecentActivityCard';

export default async function MyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profile, storyCount, planCount, likeCount, plansForAvg, recentStories, recentPlans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, nickname: true, avatarUrl: true },
    }),
    prisma.story.count({ where: { userId: user.id } }),
    prisma.myPlan.count({ where: { ownerId: user.id } }),
    prisma.like.count({ where: { story: { userId: user.id } } }),
    prisma.myPlan.findMany({
      where: { ownerId: user.id },
      select: {
        costs: { select: { amount: true } },
        flight: { select: { totalAmount: true } },
      },
    }),
    prisma.story.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.myPlan.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);
  if (!profile) redirect('/login');

  const totals = plansForAvg.map((p) => calcPlanTotal(p.costs, p.flight));
  const withTotal = totals.filter((t) => t > 0);
  const avgWon =
    withTotal.length > 0
      ? Math.floor(withTotal.reduce((s, t) => s + t, 0) / withTotal.length / 10_000)
      : null;

  return (
    <div className="max-w-md mx-auto md:max-w-none">
      <div className="mb-6">
        <p
          className="text-xs font-semibold text-sky-500 mb-1 appear-up"
          style={{ animationDelay: '0s' }}
        >
          MyPage
        </p>
        <h1
          className="text-2xl md:text-3xl font-bold text-[#1A1A1A] appear-up"
          style={{ animationDelay: '0.12s' }}
        >
          {profile.nickname ? `안녕하세요, ${profile.nickname}님` : '안녕하세요'}
        </h1>
      </div>

      <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
        <div className="glass-outer divide-y divide-black/5 appear-up" style={{ animationDelay: '0.24s' }}>
          <AvatarForm userId={user.id} nickname={profile.nickname} currentAvatarUrl={profile.avatarUrl} />
          <ActivityDashboardCard
            storyCount={storyCount}
            planCount={planCount}
            likeCount={likeCount}
            avgWon={avgWon}
          />
          <RecentActivityCard recentStories={recentStories} recentPlans={recentPlans} />
        </div>

        <div className="glass-outer divide-y divide-black/5 appear-up" style={{ animationDelay: '0.24s' }}>
          <NicknameForm email={profile.email} nickname={profile.nickname} />
          <PasswordForm />
          <DangerZoneCard />
        </div>
      </div>
    </div>
  );
}
