import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { CostPlanDetail } from './CostPlanDetail';
import type { FlightLegData } from '@/app/(protected)/my-plan/_components/FlightLeg';

type Props = { params: Promise<{ id: string }> };

function calcDurationLabel(from: Date, to: Date): string {
  const m = Math.round((to.getTime() - from.getTime()) / 60000);
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

export default async function CostPlanDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const plan = await prisma.myPlan.findFirst({
    where: { id, isPublic: true },
    select: {
      title: true,
      description: true,
      region: true,
      movie: true,
      currency: true,
      createdAt: true,
      startDate: true,
      endDate: true,
      spots: {
        select: { id: true, day: true, name: true, order: true },
        orderBy: { order: 'asc' },
      },
      costs: {
        select: { planSpotId: true, category: true, amount: true },
      },
      flight: {
        select: {
          tripType: true,
          totalAmount: true,
          outOrigin: true, outDestination: true, outAirline: true, outFlightNo: true,
          outDepartsAt: true, outArrivesAt: true,
          retOrigin: true, retDestination: true, retAirline: true, retFlightNo: true,
          retDepartsAt: true, retArrivesAt: true,
        },
      },
      _count: { select: { planLikes: true } },
      ...(user ? { planLikes: { where: { userId: user.id }, select: { id: true } } } : {}),
    },
  });

  if (!plan) notFound();

  const currency = plan.currency as 'KRW' | 'USD' | 'JPY';

  // summarizePlanCost — server-only, 결과만 클라로 전송
  const summary = summarizePlanCost(plan.costs, plan.flight, currency);

  // 카테고리만 전달 (amount 제거)
  const costCategories = plan.costs.map((c) => ({
    planSpotId: c.planSpotId,
    category: c.category,
  }));

  // 항공편: duration 계산 후 시간·날짜·금액 제거
  const publicFlight: FlightLegData | null = plan.flight
    ? {
        tripType: plan.flight.tripType as 'ONE_WAY' | 'ROUND_TRIP',
        totalAmount: 0,
        out: {
          origin: plan.flight.outOrigin,
          destination: plan.flight.outDestination,
          departsAt: '',
          arrivesAt: '',
          airline: plan.flight.outAirline,
          flightNo: plan.flight.outFlightNo,
          durationLabel: calcDurationLabel(plan.flight.outDepartsAt, plan.flight.outArrivesAt),
        },
        ...(plan.flight.retOrigin && plan.flight.retDepartsAt && plan.flight.retArrivesAt
          ? {
              ret: {
                origin: plan.flight.retOrigin,
                destination: plan.flight.retDestination!,
                departsAt: '',
                arrivesAt: '',
                airline: plan.flight.retAirline!,
                flightNo: plan.flight.retFlightNo!,
                durationLabel: calcDurationLabel(
                  plan.flight.retDepartsAt,
                  plan.flight.retArrivesAt,
                ),
              },
            }
          : {}),
      }
    : null;

  let dayCount = 1;
  if (plan.startDate && plan.endDate) {
    const diff = plan.endDate.getTime() - plan.startDate.getTime();
    dayCount = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  const createdAtLabel = plan.createdAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

  return (
    <CostPlanDetail
      planId={id}
      initialLiked={!!(plan.planLikes && plan.planLikes.length > 0)}
      initialCount={plan._count.planLikes}
      title={plan.title}
      description={plan.description}
      region={plan.region}
      movie={plan.movie}
      createdAtLabel={createdAtLabel}
      dayCount={dayCount}
      spots={plan.spots}
      costCategories={costCategories}
      publicFlight={publicFlight}
      summary={summary}
      currency={currency}
    />
  );
}
