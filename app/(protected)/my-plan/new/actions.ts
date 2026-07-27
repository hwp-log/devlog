'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { Currency, CostCategory, TripType, Prisma } from '@prisma/client';
import { searchFlights } from '@/lib/flights';
import type { FlightOffer } from '@/lib/flights';
import { pickPlanCover } from '@/lib/plan/pick-cover';
import { clampHeadcount } from '@/lib/plan/validate-input';

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
  headcount: number;
  items: SaveItem[];
  flight: FlightOffer | null;
};

function flightFields(offer: FlightOffer) {
  return {
    tripType:       offer.tripType as TripType,
    totalAmount:    offer.totalAmount,
    outOrigin:      offer.outbound.origin,
    outDestination: offer.outbound.destination,
    outDepartsAt:   new Date(offer.outbound.departsAt),
    outArrivesAt:   new Date(offer.outbound.arrivesAt),
    outAirline:     offer.outbound.airline,
    outFlightNo:    offer.outbound.flightNo,
    retOrigin:      offer.return?.origin      ?? null,
    retDestination: offer.return?.destination ?? null,
    retDepartsAt:   offer.return ? new Date(offer.return.departsAt) : null,
    retArrivesAt:   offer.return ? new Date(offer.return.arrivesAt) : null,
    retAirline:     offer.return?.airline     ?? null,
    retFlightNo:    offer.return?.flightNo    ?? null,
  };
}

async function buildPlanRows(tx: Prisma.TransactionClient, planId: string, items: SaveItem[]): Promise<void> {
  for (const item of items) {
    const spot = await tx.planSpot.create({
      data: { planId, day: item.day, order: item.order, name: item.name, lat: 0, lng: 0 },
    });
    if (item.amount > 0) {
      const category: CostCategory = item.category === '' ? 'ETC' : item.category;
      await tx.planCost.create({
        data: { planId, planSpotId: spot.id, day: item.day, category, label: item.name, amount: item.amount },
      });
    }
  }
}

export async function createPlanWithItemsAction(
  payload: SavePayload,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = payload.title.trim();
  if (!title) return { error: '제목을 입력해주세요' };

  // 커버는 생성 시 1회만 부여(수정 시 재부여 안 함). 최소 사용 후보 선택(작품+지역).
  // 트랜잭션 전 계산(읽기 전용 스냅샷). 생성이라 excludePlanId 미지정(아직 행 없음).
  const coverUrl = await pickPlanCover(payload.movie, payload.region);

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
          headcount: clampHeadcount(payload.headcount),
          coverUrl,
        },
      });
      await buildPlanRows(tx, plan.id, payload.items);
      if (payload.flight) {
        await tx.planFlight.create({ data: { planId: plan.id, ...flightFields(payload.flight) } });
      }
      return plan;
    });
    planId = result.id;
  } catch {
    return { error: '저장 중 오류가 발생했습니다' };
  }

  redirect(`/my-plan/${planId}`);
}

export async function updatePlanWithItemsAction(
  planId: string,
  payload: SavePayload,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = payload.title.trim();
  if (!title) return { error: '제목을 입력해주세요' };

  const existing = await prisma.myPlan.findFirst({ where: { id: planId, ownerId: user.id } });
  if (!existing) return { error: '수정 권한이 없습니다' };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.myPlan.update({
        where: { id: planId },
        data: {
          title,
          currency: payload.currency,
          startDate: payload.startDate ? new Date(payload.startDate) : null,
          endDate: payload.endDate ? new Date(payload.endDate) : null,
          region: payload.region || null,
          movie: payload.movie || null,
          description: payload.description || null,
          headcount: clampHeadcount(payload.headcount),
          // coverUrl 미접촉: 생성 시 1회 부여 원칙(수정 시 재부여 안 함).
        },
      });
      await tx.planCost.deleteMany({ where: { planId } });
      await tx.planSpot.deleteMany({ where: { planId } });
      await buildPlanRows(tx, planId, payload.items);
      if (payload.flight) {
        await tx.planFlight.upsert({
          where:  { planId },
          create: { planId, ...flightFields(payload.flight) },
          update: flightFields(payload.flight),
        });
      } else {
        await tx.planFlight.deleteMany({ where: { planId } });
      }
    });
  } catch {
    return { error: '저장 중 오류가 발생했습니다' };
  }

  redirect(`/my-plan/${planId}`);
}

export async function searchFlightsAction(params: {
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  originIata: string;
  destinationIata: string;
  departDate: string;
  returnDate?: string;
}): Promise<{ offers: FlightOffer[] } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  try {
    const offers = await searchFlights(params);
    return { offers };
  } catch (e) {
    console.error('[flights] search failed:', e);
    return { error: '항공편 검색에 실패했습니다' };
  }
}

type ActionState = { error: string } | null;

export async function createMyPlanAction(
  _prevState: ActionState,
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
