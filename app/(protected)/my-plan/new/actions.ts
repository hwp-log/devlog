'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { Currency, CostCategory } from '@prisma/client';

type SaveItem = {
  day: number;
  order: number;
  name: string;
  category: CostCategory | '';
  amount: number;
};

type SavePayload = {
  title: string;
  currency: Currency;
  startDate: string;
  endDate: string;
  region: string;
  movie: string;
  description: string;
  items: SaveItem[];
};

export async function createPlanWithItemsAction(
  payload: SavePayload,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = payload.title.trim();
  if (!title) return { error: '제목을 입력해주세요' };

  let planId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.myPlan.create({
        data: {
          ownerId: user.id,
          title,
          currency: payload.currency,
          startDate: payload.startDate ? new Date(payload.startDate) : null,
          endDate: payload.endDate ? new Date(payload.endDate) : null,
          region: payload.region || null,
          movie: payload.movie || null,
          description: payload.description || null,
        },
      });

      for (const item of payload.items) {
        const spot = await tx.planSpot.create({
          data: {
            planId: plan.id,
            day: item.day,
            order: item.order,
            name: item.name,
            lat: 0,
            lng: 0,
          },
        });

        if (item.amount > 0) {
          const category: CostCategory =
            item.category === '' ? 'ETC' : item.category;
          await tx.planCost.create({
            data: {
              planId: plan.id,
              planSpotId: spot.id,
              day: item.day,
              category,
              label: item.name,
              amount: item.amount,
            },
          });
        }
      }

      return plan;
    });
    planId = result.id;
  } catch {
    return { error: '저장 중 오류가 발생했습니다' };
  }

  redirect(`/my-plan/${planId}`);
}

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
