'use server';
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
  revalidatePath(`/cost-plan/${planId}`);
  revalidatePath('/cost-plan');
  return { liked, count };
}
