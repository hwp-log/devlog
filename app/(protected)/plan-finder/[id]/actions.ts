'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function togglePlanLikeAction(planId: string): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');

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

  const original = await prisma.myPlan.findFirst({
    where: { id: planId, isPublic: true },
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
          isDraft: true,
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
