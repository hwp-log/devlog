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
import { validatePlanDates, savedDateStr } from '@/lib/plan/date-limits';
import { costRowsToWrite, hasCostRowsChanged, type CostRowToWrite } from '@/lib/plan/cost-snapshot';
import { findNearbySpots } from '@/lib/spot/nearby';
import { normalizeSpotName } from '@/lib/spot/normalize-name';

// 0496: 자동 재사용 반경. 거리만으론 양방향 오류(세빛섬 62m 놓침 / 롯데월드몰↔타워 14m 오병합)라
//   거리를 200m로 넓히되 이름 정규화 일치를 AND 게이트로 세운다(오병합 차단). 스토리(nearby.ts)는 무변경.
const AUTO_REUSE_RADIUS_M = 200;

type SaveItem = {
  day: number;
  order: number;
  name: string;
  // 0562 D②: localId = 폼 항목 키(생성 randomUUID / 편집 PlanSpot.id) — dayCosts.localId와
  //   이어 2패스에서 planSpotId를 복원. category·amount는 dayCosts로 분리돼 제거.
  localId: string;
  // 0493 3단계: 검색-선택 좌표·주소. place 없는 항목(타이핑한 이동 기록 등)은 undefined.
  lat?: number;
  lng?: number;
  address?: string | null;
};

// 0562 D②: 일자별 비용 — PlanCost(day ≠ null) 동형. localId null = 기타 지출(planSpotId NULL).
type DayCostPayload = {
  localId: string | null;
  day: number;
  category: CostCategory;
  amount: number;
  label: string;
};

// 0504: 하루에 안 묶이는 비용(렌터카·항공권·보험 등). day·planSpotId 없이 저장(둘 다 NULL).
type DaylessCost = {
  label: string;
  category: CostCategory;
  amount: number;
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

// 0562 E: 항목 메타 해소 — 담은 좌표 항목을 200m+이름으로 Spot 해소해 **항목 인덱스별**
//   {spotId, coverUrl, movie, address}를 돌려준다. 구 getPlanCoverCandidates(0497·0510)의
//   상위집합이라 그것을 대체 — 구 액션은 coverUrl 중복 제거·커버 있는 Spot만 수집이라
//   항목↔메타 1:1이 성립하지 않았다(행 썸네일·칩·주소에 못 쓰는 형태).
//   coverUrl = spot.coverUrl ?? 사진 있는 최신 스토리 사진(0509) — 읽기 행
//   (plan-finder/[id]/page.tsx 평탄화)과 **같은 규칙**이어야 "저장하면 이렇게 나온다"가 성립.
//   movie = 최신 연결 대표(0185, spotMovies createdAt desc [0]).
//   findNearbySpots가 자체 인증 가드 → 미인증이면 throw. 클라는 실패를 빈 매핑으로 흡수.
//   호출 비용: 구 CoverPicker가 같은 resolveReuse를 400ms 디바운스로 돌던 자리라 신규 부하 아님.
export type ResolvedItemMeta = {
  spotId: string;
  coverUrl: string | null;
  movie: string | null;
  address: string | null;
};

export async function resolvePlanItems(
  items: { name: string; lat: number; lng: number }[],
): Promise<(ResolvedItemMeta | null)[]> {
  const resolved = await resolveReuse(
    items.map((it, i) => ({ day: 1, order: i, name: it.name, localId: String(i), lat: it.lat, lng: it.lng })),
  );
  const ids = [...new Set(resolved.map((r) => r.reusedSpotId).filter((x): x is string => !!x))];
  if (ids.length === 0) return resolved.map(() => null);
  const spots = await prisma.spot.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      coverUrl: true,
      address: true,
      spotMovies: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { movie: { select: { title: true } } },
      },
      storySpots: {
        where: { photoUrl: { not: null } },
        orderBy: { story: { createdAt: 'desc' } },
        take: 1,
        select: { photoUrl: true },
      },
    },
  });
  const byId = new Map(spots.map((s) => [s.id, s]));
  return resolved.map((r) => {
    const s = r.reusedSpotId ? byId.get(r.reusedSpotId) : undefined;
    if (!s) return null;
    return {
      spotId: s.id,
      coverUrl: s.coverUrl ?? s.storySpots[0]?.photoUrl ?? null,
      movie: s.spotMovies[0]?.movie.title ?? null,
      address: s.address,
    };
  });
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
  // 0562 D②: 일자별 비용 — 항목과 분리 수신, 2패스에서 localId로 planSpotId 복원.
  dayCosts: DayCostPayload[];
  // 0504: 무장소 비용(렌터카·항공권·보험 등). 항목 루프 밖에서 day·planSpotId NULL로 저장.
  daylessCosts: DaylessCost[];
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

// 0562 D②: 2패스 — 1패스에서 planSpot을 만들며 localId → {id, name} 매핑을 세우고,
//   2패스에서 dayCosts를 planCost로 잇는다. 구 구조(항목 루프 안 즉석 1건 생성)는 매핑이
//   없어 장소당 비용 1건·항목 부착이 강제됐다 — 분리로 다건·기타 지출(planSpotId NULL)이 열림.
async function buildPlanRows(
  tx: Prisma.TransactionClient,
  planId: string,
  items: ResolvedItem[],
  dayCosts: DayCostPayload[],
  dayless: DaylessCost[],
  // 0595: 실제로 쓴 비용 행을 돌려준다 — 호출부(수정 액션)가 "고쳤는가"를 이 값으로 판정한다.
): Promise<CostRowToWrite[]> {
  // 1패스: planSpot 생성 + localId 매핑
  const spotByLocalId = new Map<string, { id: string; name: string }>();
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
    spotByLocalId.set(item.localId, { id: spot.id, name: spot.name });
  }
  // 2패스: 일자별 비용 + 무장소 비용.
  // 0595: **저장될 행 산출을 costRowsToWrite로 위임**한다(선별·라벨 강제·order 규칙 전부).
  //   구 구조는 여기 인라인이었는데, 그러면 "고쳤는가" 판정이 같은 규칙을 두 번 적기 때문에
  //   조용히 갈린다 — 페이로드를 그대로 비교하면 **아무것도 안 고쳐도 "고쳤다"**가 된다
  //   (amount<=0 스킵 / 연결 비용 label을 장소 이름으로 강제). 쓰는 것과 비교하는 것이
  //   같은 계산이어야 한다. 규칙의 근거 주석은 lib/plan/cost-snapshot.ts에 이관.
  //   0562 D②(연결 비용 label = 장소 이름) · 0588(order는 그룹별 러닝 카운터)이 그 안에 산다.
  const rows = costRowsToWrite({
    dayCosts,
    daylessCosts: dayless,
    nameByLocalId: new Map([...spotByLocalId].map(([k, v]) => [k, v.name])),
  });
  for (const row of rows) {
    await tx.planCost.create({
      data: {
        planId,
        planSpotId: row.localId ? spotByLocalId.get(row.localId)!.id : null,
        day: row.day,
        order: row.order,
        category: row.category as CostCategory,
        label: row.label,
        amount: row.amount,
      },
    });
  }
  return rows;
}

export async function createPlanWithItemsAction(
  payload: SavePayload,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = payload.title.trim();
  if (!title) return { error: '제목을 입력해주세요' };

  // 0581: 신규는 저장값이 없으므로 하한 = 오늘. 클라의 min 속성은 타이핑 입력을 완전히
  //   막지 못하므로(브라우저는 invalid 표시만 하고 값은 들어간다) 여기가 실제 방어선이다.
  const dateError = validatePlanDates({
    startDate: payload.startDate,
    endDate: payload.endDate,
    saved: null,
  });
  if (dateError) return { error: dateError };

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
      await buildPlanRows(tx, plan.id, resolvedItems, payload.dayCosts, payload.daylessCosts);
      if (payload.flight) {
        await tx.planFlight.create({ data: { planId: plan.id, ...flightFields(payload.flight) } });
      }
      return plan;
    });
    planId = result.id;
  } catch {
    return { error: '저장 중 오류가 발생했습니다' };
  }

  // 0560: 상세 한 벌화 — 저장 후 도착지는 공개 상세(소유자 렌더)
  redirect(`/plan-finder/${planId}`);
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

  // 0595: costs를 함께 읽는다 — "금액을 고쳤는가" 판정의 이전 상태다.
  //   별도 쿼리를 만들지 않고 어차피 도는 이 조회에 관계를 얹는다(트랜잭션을 길게 만들지 않음).
  //   select는 비교 키 4개만 — order·planSpotId는 비교 대상이 아니다(cost-snapshot.ts).
  const existing = await prisma.myPlan.findFirst({
    where: { id: planId, ownerId: user.id },
    include: { costs: { select: { day: true, category: true, label: true, amount: true } } },
  });
  if (!existing) return { error: '수정 권한이 없습니다' };

  // 0581: 하한 기준은 **기존 저장값** — 이미 지난 여행을 기록한 플랜(실측 1건, 공개 시연
  //   데이터)이 날짜와 무관한 수정조차 막히면 안 된다. 값을 안 바꾸면 그대로 통과하고,
  //   더 과거로 당기는 것만 막힌다. 클라 min(MyPlanNewForm의 savedStartRef)과 같은 기준.
  const dateError = validatePlanDates({
    startDate: payload.startDate,
    endDate: payload.endDate,
    saved: savedDateStr(existing.startDate),
  });
  if (dateError) return { error: dateError };

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
      const writtenRows = await buildPlanRows(tx, planId, resolvedItems, payload.dayCosts, payload.daylessCosts);

      // 0595: "담은 뒤 금액을 고쳤다"는 이벤트 기록. 비교 대상은 페이로드가 아니라
      //   **buildPlanRows가 실제로 쓴 행**이다 — 페이로드를 비교하면 amount<=0 스킵과
      //   연결 비용 label 강제 때문에 아무것도 안 고쳐도 true가 된다(cost-snapshot.ts 주석).
      //   한 번 true면 내리지 않으므로 이미 true면 쓰지 않는다(불필요한 UPDATE 회피).
      if (!existing.costEdited && hasCostRowsChanged(existing.costs, writtenRows)) {
        await tx.myPlan.update({ where: { id: planId }, data: { costEdited: true } });
      }
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

  // 0560: 상세 한 벌화 — 편집 저장 후 도착지도 공개 상세(소유자 렌더)
  redirect(`/plan-finder/${planId}`);
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

