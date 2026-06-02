'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { Currency } from '@prisma/client';

type ActionState = { error: string } | null;

export async function createMyPlanAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = formData.get('title')?.toString().trim() ?? '';
  const currency = (formData.get('currency')?.toString() ?? 'KRW') as Currency;
  const startDateRaw = formData.get('startDate')?.toString();
  const endDateRaw = formData.get('endDate')?.toString();

  if (!title) return { error: '제목을 입력해주세요' };

  const plan = await prisma.myPlan.create({
    data: {
      ownerId: user.id,
      title,
      currency,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      endDate: endDateRaw ? new Date(endDateRaw) : null,
    },
  });

  redirect(`/my-plan/${plan.id}`);
}
