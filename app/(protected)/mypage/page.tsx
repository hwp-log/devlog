import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';
import { AvatarPreviewProvider } from './AvatarContext';
import { AvatarDisplay } from './AvatarDisplay';
import { AvatarControls } from './AvatarControls';
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

  // 0529: 좌우 성격을 카드 유무로 표시 — 왼쪽(보는 정보)은 개방 캔버스, 오른쪽(바꾸는 설정)만 카드.
  // 카드 안에서는 2px 실선을 쓰지 않는다(400px 폭에서 카드가 조각나 보임) — 카드 분리 자체가 경계.
  const card =
    'bg-card rounded-card border border-border px-[18px] py-[22px] sm:px-6 sm:py-[26px]';

  return (
    // 0536: 입출력 화면 공용 폭 --reading-w(860) — 폭 규칙 2원칙(고르는 화면=풀블리드, 그 외 860).
    //   2열 성립 검산(0536 실측): 좌측 = 860 − 400(우측 카드) − 48(gap) = 412.
    //   지표 4열 한 칸 103px vs 최악 값 `12,345만원` 88.7px(여유 14px), 라벨 최장 55.1px.
    //   최근 활동 행은 이름 truncate라 구조 붕괴 없음. 조판(1fr_400px·gap-12)은 무변.
    <div className="max-w-[var(--reading-w)] mx-auto">
      <div className="mb-6 sm:mb-9">
        <p className="text-xs font-semibold tracking-[0.12em] uppercase text-primary mb-1.5 sm:mb-2">
          MyPage
        </p>
        <h1 className="text-[26px] sm:text-[28px] font-bold tracking-[-0.02em] text-fg break-keep">
          {profile.nickname ? `안녕하세요, ${profile.nickname}님` : '안녕하세요'}
        </h1>
      </div>

      <AvatarPreviewProvider>
        <div className="space-y-[34px] md:space-y-0 md:grid md:grid-cols-[1fr_400px] md:gap-12 md:items-start">
          {/* 왼쪽: 개방 캔버스 — 프로필·내 활동·최근 활동 (섹션 간격은 각 섹션 제목의 mt로) */}
          <div className="flex flex-col">
            <AvatarDisplay
              nickname={profile.nickname}
              email={profile.email}
              currentAvatarUrl={profile.avatarUrl}
            />
            <ActivityDashboardCard
              storyCount={storyCount}
              planCount={planCount}
              likeCount={likeCount}
              avgWon={avgWon}
            />
            <RecentActivityCard recentStories={recentStories} recentPlans={recentPlans} />
          </div>

          {/* 오른쪽: 설정 카드 — 계정 설정·비밀번호 변경·계정 삭제 */}
          <div className="flex flex-col gap-4 sm:gap-5">
            <div className={card}>
              <NicknameForm email={profile.email} nickname={profile.nickname}>
                <AvatarControls userId={user.id} currentAvatarUrl={profile.avatarUrl} />
              </NicknameForm>
            </div>
            <div className={card}>
              <PasswordForm />
            </div>
            <div className={card}>
              <DangerZoneCard />
            </div>
          </div>
        </div>
      </AvatarPreviewProvider>
    </div>
  );
}
