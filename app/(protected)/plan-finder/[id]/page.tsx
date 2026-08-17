import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { visiblePlanWhere } from '@/lib/plan/queries';
import { resolvePlanDayCount } from '@/lib/plan/day-count';
import { flightTotal } from '@/lib/plan/calc-plan-total';
import { PlanFinderDetail } from './PlanFinderDetail';
import type { FlightLegData } from '@/app/(protected)/my-plan/_components/FlightLeg';

type Props = { params: Promise<{ id: string }> };

function calcDurationLabel(from: Date, to: Date): string {
  const m = Math.round((to.getTime() - from.getTime()) / 60000);
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

export default async function PlanFinderDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 0557: 공개이거나 내 것 — 남의 비공개는 404 유지, 소유자는 자기 비공개도 열람(가시성 정본: visiblePlanWhere)
  const plan = await prisma.myPlan.findFirst({
    where: { id, ...visiblePlanWhere(user?.id) },
    select: {
      // 0559: 소유자 관리 버튼군(공개 전환 토글 초기 상태)용 — 비소유자 화면엔 미사용
      isPublic: true,
      // 0560: 담은 플랜의 원본 링크(구 PlanDetail 흡수) — isOwner일 때만 렌더
      sourcePlanId: true,
      // 0594: 담은 시점 총액 스냅샷(판정에서는 0595로 빠졌으나 컬럼·조회는 유지 — 금액 표시 여지)
      sourceCostTotal: true,
      costEdited: true, // 0595: 비용 주의 배너 판정 — "고쳤다"는 이벤트 기록
      title: true,
      description: true,
      region: true,
      movie: true,
      currency: true,
      createdAt: true,
      startDate: true,
      endDate: true,
      coverUrl: true,
      headcount: true,
      spots: {
        orderBy: { order: 'asc' },
        // 0494: spotId 연결 시 Spot 정보 조인(사진·주소·작품). null이면 spot: null (있는 것만).
        select: {
          // 0501: lat/lng 추가 — 장소 카드 주소를 길찾기 링크로(좌표 있는 항목만). nullable(0493).
          id: true, day: true, name: true, order: true, spotId: true, lat: true, lng: true,
          spot: {
            select: {
              coverUrl: true,
              address: true,
              // 작품 전부 fetch, createdAt desc — 대표 = [0] (0185 최신 연결 대표 관용구)
              spotMovies: {
                orderBy: { createdAt: 'desc' },
                select: { movie: { select: { id: true, title: true } } },
              },
              // 0509: 커버 폴백용 — 사진 있는 최신 스토리 1건.
              //   최신=대표(0185, lib/spot/queries.ts 썸네일 선례와 동일 규칙·동일 정렬축).
              storySpots: {
                where: { photoUrl: { not: null } },
                orderBy: { story: { createdAt: 'desc' } },
                take: 1,
                select: { photoUrl: true },
              },
            },
          },
        },
      },
      costs: {
        // 0499: day 추가 — 항목별 상세를 일자별로 묶기 위함
        select: { planSpotId: true, category: true, amount: true, label: true, day: true },
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
      ownerId: true,
      _count: { select: { planLikes: true } },
      owner: { select: { nickname: true, avatarUrl: true } },
      ...(user ? { planLikes: { where: { userId: user.id }, select: { id: true } } } : {}),
    },
  });

  if (!plan) notFound();

  const isOwner = user?.id === plan.ownerId;
  const currency = plan.currency as 'KRW' | 'USD' | 'JPY';

  // summarizePlanCost — server-only, 결과만 클라로 전송
  // 0587: 항공은 1인 요금이라 인원을 넘긴다(정본 lib/plan/calc-plan-total.ts).
  const summary = summarizePlanCost(plan.costs, plan.flight, currency, plan.headcount);

  // 0595: 총액 대조(0594) → **이벤트 기록 대조**. 총액은 최종 상태만 봐서 상쇄 수정
  //   (한 항목 +1만, 다른 항목 -1만)을 못 잡았다 — 실제로 고쳤는데 배너가 안 사라진다.
  //   판정 자체는 저장 액션이 하고(updatePlanWithItemsAction) 여기선 기록을 읽기만 한다.
  const isCostUnchanged = !plan.costEdited;

  // 항공편. 0569: 구 처리는 "duration 계산 후 시간·날짜 제거"였다 — 공개 화면에서 값을 가공해
  //   덜 보여주는 계열(0492 금액 비중·구간 가공)의 잔재다. 0557(비공개 = 글 자체를 가림)·
  //   0558(공개한 것은 실값으로)이 그 계열을 뒤집었으므로 시각만 남겨둘 이유가 없다.
  //   departsAt·arrivesAt를 실값으로 넘긴다(표시 조판은 PublicFlightTable).
  const publicFlight: FlightLegData | null = plan.flight
    ? {
        tripType: plan.flight.tripType as 'ONE_WAY' | 'ROUND_TRIP',
        // 0587: 여기서부터는 **전원 총액**이다(DB는 1인 요금 — 정본 lib/plan/calc-plan-total.ts).
        //   PublicCostSection이 이 값을 그대로 그리므로(항공권 그룹 요약·탑승료·상세내역 행)
        //   summary와 같은 기준이어야 한다 — 한쪽만 곱하면 그룹 합과 총액이 어긋난다.
        //   PublicFlightTable은 금액을 그리지 않는다(편별 가격 열 없음, 0492).
        totalAmount: flightTotal(plan.flight, plan.headcount),
        out: {
          origin: plan.flight.outOrigin,
          destination: plan.flight.outDestination,
          departsAt: plan.flight.outDepartsAt.toISOString(),
          arrivesAt: plan.flight.outArrivesAt.toISOString(),
          airline: plan.flight.outAirline,
          flightNo: plan.flight.outFlightNo,
          durationLabel: calcDurationLabel(plan.flight.outDepartsAt, plan.flight.outArrivesAt),
        },
        ...(plan.flight.retOrigin && plan.flight.retDepartsAt && plan.flight.retArrivesAt
          ? {
              ret: {
                origin: plan.flight.retOrigin,
                destination: plan.flight.retDestination!,
                departsAt: plan.flight.retDepartsAt.toISOString(),
                arrivesAt: plan.flight.retArrivesAt.toISOString(),
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

  // 0582: 날짜가 없으면 PlanSpot의 최대 day로 — 구 폴백 1은 담은 플랜(날짜 미복사)에서
  //   Day 2·3을 통째로 가렸다. 규칙 정본은 lib/plan/day-count.ts.
  const dayCount = resolvePlanDayCount(plan.startDate, plan.endDate, plan.spots);

  const createdAtLabel = plan.createdAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

  return (
    <PlanFinderDetail
      planId={id}
      initialLiked={!!(plan.planLikes && plan.planLikes.length > 0)}
      initialCount={plan._count.planLikes}
      title={plan.title}
      description={plan.description}
      region={plan.region}
      movie={plan.movie}
      coverUrl={plan.coverUrl}
      headcount={plan.headcount}
      createdAtLabel={createdAtLabel}
      dayCount={dayCount}
      startDate={plan.startDate}
      endDate={plan.endDate}
      spots={plan.spots.map((s) => ({
        id: s.id,
        day: s.day,
        name: s.name,
        order: s.order,
        // 0501: 좌표 있는 항목만 길찾기 링크(없으면 평범한 텍스트). PlanSpot.lat/lng는 nullable.
        lat: s.lat,
        lng: s.lng,
        // 0494: 연결 Spot 조인값 평탄화(미연결이면 null). 대표 작품 = spotMovies[0].
        // 0509: coverUrl 우선, 없으면 사진 있는 최신 스토리 사진(조회 폴백 — 저장 무변경).
        coverUrl: s.spot?.coverUrl ?? s.spot?.storySpots[0]?.photoUrl ?? null,
        address: s.spot?.address ?? null,
        movie: s.spot?.spotMovies?.[0]?.movie.title ?? null,
      }))}
      publicFlight={publicFlight}
      summary={summary}
      currency={currency}
      authorNickname={plan.owner.nickname}
      authorAvatarUrl={plan.owner.avatarUrl}
      isOwner={isOwner}
      isPublic={plan.isPublic}
      sourcePlanId={plan.sourcePlanId}
      isCostUnchanged={isCostUnchanged}
    />
  );
}
