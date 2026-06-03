import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { MyPlan, PlanSpot, PlanCost } from '@prisma/client';
import { MyPlanNewForm } from '../../new/MyPlanNewForm';
import type { EditorState, DayPlan, PlanItem } from '../../new/MyPlanNewForm';

type Props = { params: Promise<{ id: string }> };
type FullPlan = MyPlan & { spots: PlanSpot[]; costs: PlanCost[] };

function buildInitialState(plan: FullPlan, dayCount: number): EditorState {
  const costBySpotId = new Map(
    plan.costs
      .filter((c) => c.planSpotId != null)
      .map((c) => [c.planSpotId!, c]),
  );

  const spotsByDay = new Map<number, PlanSpot[]>();
  for (const spot of plan.spots) {
    const arr = spotsByDay.get(spot.day) ?? [];
    arr.push(spot);
    spotsByDay.set(spot.day, arr);
  }

  const days: DayPlan[] = Array.from({ length: dayCount }, (_, i) => {
    const day = i + 1;
    const daySpots = spotsByDay.get(day) ?? [];
    const items: PlanItem[] = daySpots.map((spot) => {
      const cost = costBySpotId.get(spot.id);
      return {
        id: spot.id,
        name: spot.name,
        category: (cost?.category ?? '') as PlanItem['category'],
        amount: cost?.amount ?? 0,
      };
    });
    return { day, items };
  });

  return {
    title: plan.title,
    currency: plan.currency as EditorState['currency'],
    startDate: plan.startDate ? plan.startDate.toISOString().split('T')[0] : '',
    endDate: plan.endDate ? plan.endDate.toISOString().split('T')[0] : '',
    region: plan.region ?? '',
    movie: plan.movie ?? '',
    description: plan.description ?? '',
    days,
  };
}

export default async function MyPlanEditPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const plan = await prisma.myPlan.findFirst({
    where: { id, ownerId: user.id },
    include: {
      spots: { orderBy: { order: 'asc' } },
      costs: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!plan) notFound();

  let dayCount = 1;
  if (plan.startDate && plan.endDate) {
    const diff = plan.endDate.getTime() - plan.startDate.getTime();
    dayCount = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  return (
    <div>
      <MyPlanNewForm initialState={buildInitialState(plan, dayCount)} mode="edit" planId={plan.id} />
    </div>
  );
}
