import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { visiblePlanWhere } from '@/lib/plan/queries';
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
  const summary = summarizePlanCost(plan.costs, plan.flight, currency);

  // 항공편: duration 계산 후 시간·날짜 제거(금액은 공개 — 왕복 총액은 상세 섹션 제목이 표기)
  const publicFlight: FlightLegData | null = plan.flight
    ? {
        tripType: plan.flight.tripType as 'ONE_WAY' | 'ROUND_TRIP',
        totalAmount: plan.flight.totalAmount,
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
    />
  );
}
