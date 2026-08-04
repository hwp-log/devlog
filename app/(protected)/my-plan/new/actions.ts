'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { Currency, CostCategory, TripType, Prisma } from '@prisma/client';
import { searchFlights } from '@/lib/flights';
import type { FlightOffer } from '@/lib/flights';
import { pickPlanCover, firstOwnSpotCover } from '@/lib/plan/pick-cover';
import { normalizeRegionKey } from '@/lib/plan/region-cover';
import { inferRegionKey, inferMovieTitle } from '@/lib/plan/infer-plan-meta';
import { clampHeadcount } from '@/lib/plan/validate-input';
import { findNearbySpots } from '@/lib/spot/nearby';

// 자동 재사용 반경 — nearby.ts DEFAULT 100m는 사람 판단용(넓게 포섭). 플랜 폼엔 chooser가 없어
// 자동 채택이므로 오병합("롯데월드몰"≠"롯데월드타워") 방지 위해 보수화: 실중복 14m + 지터 여유.
const AUTO_REUSE_RADIUS_M = 30;

type SaveItem = {
  day: number;
  order: number;
  name: string;
  category: CostCategory | '';
  amount: number;
  // 0493 3단계: 검색-선택 좌표·주소. place 없는 항목(타이핑한 이동 기록 등)은 undefined.
  lat?: number;
  lng?: number;
  address?: string | null;
};

// 재사용 판정을 tx 밖에서 선행(findNearbySpots는 자체 auth+글로벌 prisma read라 tx 홀딩 회피 — story의 pre-tx 전처리와 동형).
type ResolvedItem = SaveItem & { reusedSpotId: string | null; hasCoords: boolean };
async function resolveReuse(items: SaveItem[]): Promise<ResolvedItem[]> {
  return Promise.all(items.map(async (it) => {
    if (it.lat == null || it.lng == null) return { ...it, reusedSpotId: null, hasCoords: false };
    const near = await findNearbySpots(it.lat, it.lng, AUTO_REUSE_RADIUS_M);
    return { ...it, reusedSpotId: near[0]?.spotId ?? null, hasCoords: true };
  }));
}

// 0495: 재사용 Spot의 커버·작품을 한 번에 조회 → 자기 커버(우선순위 1)·작품 추론에 사용.
//   신규 생성 Spot은 아직 커버·작품이 없어 자연 제외.
async function resolveCover(payload: SavePayload, items: ResolvedItem[]): Promise<string | null> {
  const reusedIds = [...new Set(items.map((i) => i.reusedSpotId).filter((x): x is string => !!x))];
  const reusedSpots = reusedIds.length
    ? await prisma.spot.findMany({
        where: { id: { in: reusedIds } },
        select: { id: true, coverUrl: true, spotMovies: { select: { movie: { select: { title: true } } } } },
      })
    : [];
  const coverById = new Map(reusedSpots.map((s) => [s.id, s.coverUrl]));

  // 우선순위 1: 담은 Spot의 커버(재사용 Spot 한정 — 신규는 커버 없음).
  const ownSpots = items
    .filter((i) => i.reusedSpotId)
    .map((i) => ({ order: i.order, coverUrl: coverById.get(i.reusedSpotId!) ?? null }));
  const own = firstOwnSpotCover(ownSpots);
  if (own) return own;

  // 폴백: region/movie 비었거나 해석 실패면 담은 Spot에서 추론(사용자 입력 우선, 저장 필드는 미변경).
  const region = normalizeRegionKey(payload.region)
    ? payload.region
    : inferRegionKey(items.map((i) => i.address));
  const movie = payload.movie?.trim()
    ? payload.movie
    : inferMovieTitle(reusedSpots.flatMap((s) => s.spotMovies.map((m) => m.movie.title)));
  return pickPlanCover(movie, region);
}

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

async function buildPlanRows(tx: Prisma.TransactionClient, planId: string, items: ResolvedItem[]): Promise<void> {
  for (const item of items) {
    // 0493 3단계: 좌표 있으면 create-or-reuse로 실 Spot 연결, 없으면 좌표·spotId NULL(0,0 폐기).
    let spotId: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    if (item.hasCoords) {
      lat = item.lat!;
      lng = item.lng!;
      if (item.reusedSpotId) {
        spotId = item.reusedSpotId; // 30m 내 기존 Spot 재사용(증식 방지)
      } else {
        const created = await tx.spot.create({
          data: { storyId: null, name: item.name, lat, lng, address: item.address ?? null, order: item.order, source: 'user' },
        });
        spotId = created.id;
      }
    }
    const spot = await tx.planSpot.create({
      data: { planId, day: item.day, order: item.order, name: item.name, lat, lng, spotId },
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

  // 재사용 판정을 먼저(주소·재사용 spotId 확보 → 커버 선택에 사용). tx 밖 read.
  const resolvedItems = await resolveReuse(payload.items);

  // 커버는 생성 시 1회만 부여. 우선순위: 담은 Spot 커버 → 작품 → 지역 → null (resolveCover).
  const coverUrl = await resolveCover(payload, resolvedItems);

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
      await buildPlanRows(tx, plan.id, resolvedItems);
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

  // 재사용 판정은 tx 밖에서 선행(create와 동형). 수정 폼은 4단계 전까지 place 미탑재라
  // 재검색하지 않은 항목은 hasCoords=false → 좌표·spotId NULL(기존과 동일).
  const resolvedItems = await resolveReuse(payload.items);

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
      await buildPlanRows(tx, planId, resolvedItems);
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
