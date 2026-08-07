'use server';
import { redirect } from 'next/navigation';
import { visiblePlanWhere } from '@/lib/plan/queries';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function togglePlanLikeAction(planId: string): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');

  // 0557: 공개이거나 내 것(visiblePlanWhere) — 페이지·copyPublicPlanAction과 동일 게이트.
  // 미존재 planId도 여기서 걸러짐 (FK 에러 사전 차단)
  const plan = await prisma.myPlan.findFirst({
    where: { id: planId, ...visiblePlanWhere(user.id) },
    select: { id: true },
  });
  if (!plan) throw new Error('플랜을 찾을 수 없습니다');

  const existing = await prisma.planLike.findUnique({
    where: { planId_userId: { planId, userId: user.id } },
  });

  let liked: boolean;
  if (existing) {
    await prisma.planLike.delete({ where: { planId_userId: { planId, userId: user.id } } });
    liked = false;
  } else {
    try {
      await prisma.planLike.create({ data: { planId, userId: user.id } });
      liked = true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        liked = true;
      } else {
        throw e;
      }
    }
  }

  const count = await prisma.planLike.count({ where: { planId } });
  revalidatePath(`/plan-finder/${planId}`);
  revalidatePath('/plan-finder');
  return { liked, count };
}

export async function copyPublicPlanAction(
  planId: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 0557: 공개이거나 내 것 — 자기 비공개 담기는 무해(버튼은 isOwner 숨김, 방어만 공유)
  const original = await prisma.myPlan.findFirst({
    where: { id: planId, ...visiblePlanWhere(user.id) },
    select: {
      title: true,
      description: true,
      region: true,
      movie: true,
      currency: true,
      owner: { select: { nickname: true } },
      spots: {
        select: { day: true, order: true, name: true, lat: true, lng: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!original) return { error: '원본 플랜을 찾을 수 없습니다' };

  try {
    await prisma.$transaction(async (tx) => {
      const plan = await tx.myPlan.create({
        data: {
          ownerId: user.id,
          isPublic: false,
          sourcePlanId: planId,
          sourceNickname: original.owner.nickname,
          title: original.title,
          currency: original.currency,
          description: original.description,
          region: original.region,
          movie: original.movie,
        },
      });
      for (const spot of original.spots) {
        await tx.planSpot.create({
          data: { planId: plan.id, day: spot.day, order: spot.order, name: spot.name, lat: spot.lat, lng: spot.lng },
        });
      }
    });
  } catch {
    return { error: '복사 중 오류가 발생했습니다' };
  }

  redirect('/my-plan');
}
