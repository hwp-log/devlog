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
      // 0556: 일정 행 공용화(PlanItemRow) — 공개 상세 page(0494·0501·0509)와 동일한 Spot 조인.
      //   사진·주소·대표 작품 + 사진 있는 최신 스토리 폴백. 미연결(spotId null)이면 spot: null.
      spots: {
        orderBy: { order: 'asc' },
        include: {
          spot: {
            select: {
              coverUrl: true,
              address: true,
              spotMovies: {
                orderBy: { createdAt: 'desc' },
                select: { movie: { select: { id: true, title: true } } },
              },
              storySpots: {
                where: { photoUrl: { not: null } },
                orderBy: { story: { createdAt: 'desc' } },
                take: 1,
                select: { photoUrl: true },
              },
            },
          },
        },
      },
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

  // 0556: 조인값 평탄화 — 공개 상세 page 146~159행과 동일 규칙(커버 폴백 0509 포함)
  const enrichedSpots = plan.spots.map((s) => ({
    id: s.id,
    day: s.day,
    order: s.order,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    coverUrl: s.spot?.coverUrl ?? s.spot?.storySpots[0]?.photoUrl ?? null,
    address: s.spot?.address ?? null,
    movie: s.spot?.spotMovies?.[0]?.movie.title ?? null,
  }));

  return (
    <PlanDetail
      plan={plan}
      enrichedSpots={enrichedSpots}
      dayCount={dayCount}
      deleteAction={deleteMyPlanAction}
      ownerNickname={profile?.nickname ?? ''}
      ownerAvatarUrl={profile?.avatarUrl ?? null}
      createdAtLabel={plan.createdAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
    />
  );
}
