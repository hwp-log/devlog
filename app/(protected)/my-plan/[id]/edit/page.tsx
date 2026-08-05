import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { MyPlan, PlanSpot, PlanCost, PlanFlight } from '@prisma/client';
import { MyPlanNewForm } from '../../new/MyPlanNewForm';
import type { EditorState, DayPlan, PlanItem } from '../../new/MyPlanNewForm';
import type { FlightOffer } from '@/lib/flights';

type Props = { params: Promise<{ id: string }> };
// 0493 4단계: spots에 연결 Spot의 address 조인(place 메타 복원용).
type FullPlanSpot = PlanSpot & { spot: { address: string | null } | null };
type FullPlan = MyPlan & { spots: FullPlanSpot[]; costs: PlanCost[]; flight: PlanFlight | null };

function buildInitialState(plan: FullPlan, dayCount: number): EditorState {
  const costBySpotId = new Map(
    plan.costs
      .filter((c) => c.planSpotId != null)
      .map((c) => [c.planSpotId!, c]),
  );

  // 0504: 무장소 비용(day·planSpotId 둘 다 NULL)을 별도 컬렉션으로 복원 —
  //   장소 매칭에서 드롭돼 다음 저장 때 영구 소실되던 경로 차단(라운드트립 보존).
  const daylessCosts = plan.costs
    .filter((c) => c.day == null && c.planSpotId == null)
    .map((c) => ({ label: c.label, category: c.category, amount: c.amount }));

  const spotsByDay = new Map<number, FullPlanSpot[]>();
  for (const spot of plan.spots) {
    const arr = spotsByDay.get(spot.day) ?? [];
    arr.push(spot);
    spotsByDay.set(spot.day, arr);
  }

  const days: DayPlan[] = Array.from({ length: dayCount }, (_, i) => {
    const day = i + 1;
    const daySpots = spotsByDay.get(day) ?? [];
    const items: PlanItem[] = daySpots.map((ps) => {
      const cost = costBySpotId.get(ps.id);
      return {
        id: ps.id,
        name: ps.name,
        category: (cost?.category ?? '') as PlanItem['category'],
        amount: cost?.amount ?? 0,
        // 0493 4단계: 좌표 있으면 1단계 place 메타 형태로 복원(주소는 연결 Spot에서 조인). 없으면 undefined.
        place: (ps.lat != null && ps.lng != null)
          ? { id: ps.spotId ?? '', lat: ps.lat, lng: ps.lng, address: ps.spot?.address ?? '' }
          : undefined,
      };
    });
    return { day, items };
  });

  const flightSlot: FlightOffer | null = plan.flight ? {
    tripType: plan.flight.tripType as 'ONE_WAY' | 'ROUND_TRIP',
    totalAmount: plan.flight.totalAmount,
    outbound: {
      origin:      plan.flight.outOrigin,
      destination: plan.flight.outDestination,
      departsAt:   plan.flight.outDepartsAt.toISOString(),
      arrivesAt:   plan.flight.outArrivesAt.toISOString(),
      airline:     plan.flight.outAirline,
      flightNo:    plan.flight.outFlightNo,
    },
    return: plan.flight.retOrigin ? {
      origin:      plan.flight.retOrigin,
      destination: plan.flight.retDestination!,
      departsAt:   plan.flight.retDepartsAt!.toISOString(),
      arrivesAt:   plan.flight.retArrivesAt!.toISOString(),
      airline:     plan.flight.retAirline!,
      flightNo:    plan.flight.retFlightNo!,
    } : undefined,
  } : null;

  return {
    title: plan.title,
    currency: plan.currency as EditorState['currency'],
    startDate: plan.startDate ? plan.startDate.toISOString().split('T')[0] : '',
    endDate: plan.endDate ? plan.endDate.toISOString().split('T')[0] : '',
    region: plan.region ?? '',
    movie: plan.movie ?? '',
    description: plan.description ?? '',
    headcount: plan.headcount,
    days,
    daylessCosts, // 0504: 무장소 비용 복원(현재 UI 없음 — 라운드트립 보존용)
    flight: flightSlot,
    coverUrl: plan.coverUrl, // 0497: 기존 대표 이미지 복원(picker 후보면 선택 상태로 표시)
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
      spots: { orderBy: { order: 'asc' }, include: { spot: { select: { address: true } } } },
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

  return (
    <div>
      <MyPlanNewForm initialState={buildInitialState(plan, dayCount)} mode="edit" planId={plan.id} />
    </div>
  );
}
