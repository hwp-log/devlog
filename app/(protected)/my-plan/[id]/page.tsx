import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { PlanDetail } from './PlanDetail';
import { deleteMyPlanAction } from '../actions';

type Props = { params: Promise<{ id: string }> };

export default async function MyPlanDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 0555: 메타 행(아바타·닉네임)용 프로필 — 공개 상세 메타 행과 동형
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { nickname: true, avatarUrl: true },
  });

  const plan = await prisma.myPlan.findFirst({
    where: { id, ownerId: user.id },
    include: {
      spots: { orderBy: { order: 'asc' } },
      costs: { orderBy: { createdAt: 'asc' } },
      flight: true,
    },
  });
  if (!plan) notFound();

  let dayCount = 1;
  if (plan.startDate && plan.endDate) {
    const diff = plan.endDate.getTime() - plan.startDate.getTime();
    dayCount = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  return (
    <PlanDetail
      plan={plan}
      dayCount={dayCount}
      deleteAction={deleteMyPlanAction}
      ownerNickname={profile?.nickname ?? ''}
      ownerAvatarUrl={profile?.avatarUrl ?? null}
      createdAtLabel={plan.createdAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
    />
  );
}
