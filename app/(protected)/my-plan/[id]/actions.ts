'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { CostCategory } from '@prisma/client';

type ActionState = { error: string } | null;

export async function addPlanItemAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const planId = formData.get('planId')?.toString() ?? '';
  const day = Number(formData.get('day'));
  const name = formData.get('name')?.toString().trim() ?? '';
  const categoryRaw = formData.get('category')?.toString();
  const amountRaw = formData.get('amount')?.toString();

  if (!name) return { error: '이름을 입력해주세요' };

  // 소유 검증 — 클라이언트에서 받은 planId가 본인 것인지 확인
  const plan = await prisma.myPlan.findFirst({
    where: { id: planId, ownerId: user.id },
    select: { id: true },
  });
  if (!plan) return { error: '권한이 없습니다' };

  const hasCost =
    categoryRaw &&
    amountRaw &&
    Number(amountRaw) > 0;

  await prisma.$transaction(async (tx) => {
    const existingCount = await tx.planSpot.count({
      where: { planId, day },
    });

    const newSpot = await tx.planSpot.create({
      data: {
        planId,
        day,
        order: existingCount + 1,
        name,
        lat: 0,
        lng: 0,
      },
    });

    if (hasCost) {
      await tx.planCost.create({
        data: {
          planId,
          day,
          category: categoryRaw as CostCategory,
          label: name,
          amount: Number(amountRaw),
          planSpotId: newSpot.id,
        },
      });
    }
  });

  redirect(`/my-plan/${planId}`);
}
