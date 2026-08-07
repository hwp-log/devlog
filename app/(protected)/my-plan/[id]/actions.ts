'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function togglePlanPublicAction(
  planId: string,
  isPublic: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const plan = await prisma.myPlan.findFirst({
    where: { id: planId, ownerId: user.id },
    select: { id: true },
  });
  if (!plan) return;

  await prisma.myPlan.update({
    where: { id: planId },
    data: { isPublic },
  });

  // 0560: /my-plan/${planId} revalidate 제거 — 상세 라우트 폐기(redirect 스텁만 잔존).
  revalidatePath('/my-plan');
  revalidatePath('/plan-finder');
  // 0559: 공개 상세에서도 토글 가능(PlanOwnerActions 공용) — 미갱신 시 transition 종료 후
  //   optimistic이 stale 서버 값으로 되돌아가 버튼이 이전 상태로 보인다.
  revalidatePath(`/plan-finder/${planId}`);
}
