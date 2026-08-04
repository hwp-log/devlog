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
import { normalizeSpotName } from '@/lib/spot/normalize-name';

// 0496: 자동 재사용 반경. 거리만으론 양방향 오류(세빛섬 62m 놓침 / 롯데월드몰↔타워 14m 오병합)라
//   거리를 200m로 넓히되 이름 정규화 일치를 AND 게이트로 세운다(오병합 차단). 스토리(nearby.ts)는 무변경.
const AUTO_REUSE_RADIUS_M = 200;

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
    // 0496: near는 거리순 — 정규화 이름 일치하는 최근접만 재사용. 이름 다르면 신규 생성(오병합 차단).
    const hit = it.name ? near.find((c) => normalizeSpotName(c.name) === normalizeSpotName(it.name)) : undefined;
    return { ...it, reusedSpotId: hit?.spotId ?? null, hasCoords: true };
  }));
}

// 0497: 대표 이미지 후보 조회 — 담은 좌표 항목을 200m+이름으로 Spot 해소, 커버 있는 재사용 Spot의
//   {coverUrl,name}을 order순 수집(coverUrl 중복 제거). 작성 화면 CoverPicker가 항목 변경 시 호출.
//   findNearbySpots가 자체 인증 가드 → 미인증이면 throw(UNAUTHENTICATED). 클라는 실패를 빈 후보로 흡수.
export async function getPlanCoverCandidates(
  items: { name: string; lat: number; lng: number }[],
): Promise<{ coverUrl: string; name: string }[]> {
  const resolved = await resolveReuse(
    items.map((it, i) => ({ day: 1, order: i, name: it.name, category: '' as const, amount: 0, lat: it.lat, lng: it.lng })),
  );
  const ids = [...new Set(resolved.map((r) => r.reusedSpotId).filter((x): x is string => !!x))];
  if (ids.length === 0) return [];
  const spots = await prisma.spot.findMany({ where: { id: { in: ids }, coverUrl: { not: null } }, select: { id: true, name: true, coverUrl: true } });
  const coverById = new Map(spots.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: { coverUrl: string; name: string }[] = [];
  for (const r of resolved) {
    const s = r.reusedSpotId ? coverById.get(r.reusedSpotId) : undefined;
    if (!s?.coverUrl || seen.has(s.coverUrl)) continue;
    seen.add(s.coverUrl);
    out.push({ coverUrl: s.coverUrl, name: s.name });
  }
  return out;
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
  // 0497: 작성자가 고른 대표 이미지. null이면 자동(resolveCover). 후보에서만 오지만 클라값이라 MVP는 신뢰.
  coverUrl: string | null;
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

  // 0497: 작성자가 고른 값 우선, 없으면 자동(담은 Spot 커버 → 작품 → 지역 → null).
  const coverUrl = payload.coverUrl ?? (await resolveCover(payload, resolvedItems));

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
          // 0497: 기본은 coverUrl 미접촉(생성 1회 원칙). 단 작성자가 고른 값이 오면 그때만 갱신(예외).
          ...(payload.coverUrl ? { coverUrl: payload.coverUrl } : {}),
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
