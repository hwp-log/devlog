import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { MyPlan, PlanSpot, PlanCost, PlanFlight } from '@prisma/client';
import { MyPlanNewForm } from '../../new/MyPlanNewForm';
import type { EditorState, DayPlan, PlanItem, DayCost } from '../../new/MyPlanNewForm';
import type { FlightOffer } from '@/lib/flights';

type Props = { params: Promise<{ id: string }> };
// 0493 4단계: spots에 연결 Spot의 address 조인(place 메타 복원용).
type FullPlanSpot = PlanSpot & { spot: { address: string | null } | null };
type FullPlan = MyPlan & { spots: FullPlanSpot[]; costs: PlanCost[]; flight: PlanFlight | null };

function buildInitialState(plan: FullPlan, dayCount: number): EditorState {
  // 0562 D②: 비용 복원 3분류 — 구 costBySpotId Map(planSpotId당 1건, 항목에 부착) 폐기.
  //   ① day=null                → daylessCosts (여행 고정 비용).
  //     day=null && planSpotId≠null은 현 저장 경로가 만들지 않는 형태 — 생기면 라벨이
  //     있으니 고정 비용으로 방어 편입(드롭 금지).
  //   ② day≠null                → dayCosts. localId = planSpotId(편집의 item.id = PlanSpot.id).
  //     planSpotId=null(시드 90행·기타 지출)도 localId null로 자연 포섭 —
  //     **구 코드는 이 형태를 어느 분류에도 못 넣고 드롭해 재저장 시 전량 소실**되던 버그 해소.
  const daylessCosts = plan.costs
    .filter((c) => c.day == null)
    .map((c) => ({ label: c.label, category: c.category, amount: c.amount }));

  const dayCosts: DayCost[] = plan.costs
    .filter((c) => c.day != null)
    .map((c) => ({
      localId: c.planSpotId,
      day: c.day!,
      category: c.category,
      amount: c.amount,
      // 0562 D fix①: 연결 비용의 label은 비운다 — label은 기타 지출에서만 의미(서버가 연결
      //   비용의 label을 장소 이름으로 강제하는 규칙과 정합). 저장값(장소 이름 사본)을 실으면
      //   "기타 지출"로 전환할 때 직전 장소 이름이 라벨 칸에 남는다(실검수 발견).
      //   빈 label로 저장될 위험은 없다 — 연결이면 서버가 다시 장소 이름을 넣고(2패스 label
      //   강제), 기타 지출은 클라 선별(savableDayCosts)이 빈 라벨을 제외한다.
      label: c.planSpotId ? '' : c.label,
    }));

  const spotsByDay = new Map<number, FullPlanSpot[]>();
  for (const spot of plan.spots) {
    const arr = spotsByDay.get(spot.day) ?? [];
    arr.push(spot);
    spotsByDay.set(spot.day, arr);
  }

  const days: DayPlan[] = Array.from({ length: dayCount }, (_, i) => {
    const day = i + 1;
    const daySpots = spotsByDay.get(day) ?? [];
    const items: PlanItem[] = daySpots.map((ps) => ({
      id: ps.id,
      name: ps.name,
      // 0493 4단계: 좌표 있으면 1단계 place 메타 형태로 복원(주소는 연결 Spot에서 조인). 없으면 undefined.
      // 0562 D①: 구 id: ps.spotId 복원 폐기 — 생성 경로(Kakao POI id)와 의미가 갈리던
      //   필드 자체를 제거(정본 주석: MyPlanNewForm PlanItem.place).
      place: (ps.lat != null && ps.lng != null)
        ? { lat: ps.lat, lng: ps.lng, address: ps.spot?.address ?? '' }
        : undefined,
    }));
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
    dayCosts, // 0562 D②: 일자별 비용 복원 — 장소당 다건·기타 지출 포함
    daylessCosts,
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
    // 0536: 작성 화면(my-plan/new/page)과 같은 폼·같은 폭 래퍼(--reading-w 860) —
    //   한쪽만 바꾸면 폭이 어긋난다. 검산은 new 쪽 주석 참조.
    <div className="max-w-[var(--reading-w)] mx-auto">
      <MyPlanNewForm initialState={buildInitialState(plan, dayCount)} mode="edit" planId={plan.id} />
    </div>
  );
}
