'use server';
import { redirect } from 'next/navigation';
import { visiblePlanWhere } from '@/lib/plan/queries';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function togglePlanLikeAction(planId: string): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');

  // 0557: 공개이거나 내 것(visiblePlanWhere) — 페이지·copyPublicPlanAction과 동일 게이트.
  // 미존재 planId도 여기서 걸러짐 (FK 에러 사전 차단)
  const plan = await prisma.myPlan.findFirst({
    where: { id: planId, ...visiblePlanWhere(user.id) },
    select: { id: true },
  });
  if (!plan) throw new Error('플랜을 찾을 수 없습니다');

  const existing = await prisma.planLike.findUnique({
    where: { planId_userId: { planId, userId: user.id } },
  });

  let liked: boolean;
  if (existing) {
    await prisma.planLike.delete({ where: { planId_userId: { planId, userId: user.id } } });
    liked = false;
  } else {
    try {
      await prisma.planLike.create({ data: { planId, userId: user.id } });
      liked = true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        liked = true;
      } else {
        throw e;
      }
    }
  }

  const count = await prisma.planLike.count({ where: { planId } });
  revalidatePath(`/plan-finder/${planId}`);
  revalidatePath('/plan-finder');
  return { liked, count };
}

export async function copyPublicPlanAction(
  planId: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 0557: 공개이거나 내 것 — 자기 비공개 담기는 무해(버튼은 isOwner 숨김, 방어만 공유)
  const original = await prisma.myPlan.findFirst({
    where: { id: planId, ...visiblePlanWhere(user.id) },
    select: {
      title: true,
      description: true,
      region: true,
      movie: true,
      currency: true,
      // 0579: 날짜·인원 추가. 날짜가 없으면 두 화면(plan-finder/[id]/page·my-plan/[id]/edit/page)이
      //   dayCount를 1로 폴백해 day≥2 항목이 **행은 있는데 화면에 없는** 상태가 된다.
      //   그 상태로 편집 저장하면 updatePlanWithItemsAction의 deleteMany+재생성이
      //   day 2·3을 실제로 지운다 — 표시 문제가 데이터 손실로 확정되던 경로.
      startDate: true,
      endDate: true,
      headcount: true,
      owner: { select: { nickname: true } },
      spots: {
        // 0579: id는 비용 재매핑용(아래 spotIdMap), spotId는 Spot 연결 승계용.
        //   spotId를 안 옮기면 사본의 장소 사진·주소·작품이 통째로 빈다(0494 조인 소스).
        select: { id: true, day: true, order: true, name: true, lat: true, lng: true, spotId: true },
        orderBy: { order: 'asc' },
      },
      // 0579: 비용·항공 복사 개시. 0103은 비용을 "PII라 복사 제외"로 못 박았지만 그 근거는
      //   0097 "공개 상세는 정밀 금액을 미전송·구간 가공"이었다. 0557(비공개 = 글 자체를 가림)·
      //   0558(공개한 것은 실값으로)이 그 계열을 폐기하면서 **전제가 소멸했다** —
      //   공개 상세에서 이미 실값으로 보이는 금액을 담기에서만 막을 이유가 없다.
      //   (0103 회고는 시점 기록이라 고치지 않는다. 뒤집힌 결정의 정본은 이 주석.)
      //   항공은 0103이 언급조차 하지 않았다 — 배제 의도가 기록된 적 없는 누락분.
      costs: {
        select: { planSpotId: true, day: true, category: true, label: true, amount: true },
      },
      flight: {
        select: {
          tripType: true, totalAmount: true,
          outOrigin: true, outDestination: true, outDepartsAt: true, outArrivesAt: true,
          outAirline: true, outFlightNo: true,
          retOrigin: true, retDestination: true, retDepartsAt: true, retArrivesAt: true,
          retAirline: true, retFlightNo: true,
        },
      },
    },
  });

  if (!original) return { error: '원본 플랜을 찾을 수 없습니다' };

  try {
    await prisma.$transaction(async (tx) => {
      const plan = await tx.myPlan.create({
        data: {
          ownerId: user.id,
          isPublic: false,
          sourcePlanId: planId,
          sourceNickname: original.owner.nickname,
          title: original.title,
          currency: original.currency,
          description: original.description,
          region: original.region,
          movie: original.movie,
          startDate: original.startDate,
          endDate: original.endDate,
          headcount: original.headcount,
          // coverUrl은 복사하지 않는다(0579 명시 제외) — 원본 이미지 소유권.
          // isPublic도 false 고정 유지 — 담은 것이 자동으로 다시 공개되지 않는다.
        },
      });
      // 0579: PlanCost.planSpotId 재매핑용 원본id → 사본id. 원본 id를 그대로 실으면
      //   **남의 플랜 항목을 가리키는 비용 행**이 생긴다. 2패스 구조는 저장 경로
      //   (my-plan/new/actions.ts buildPlanRows)의 localId 매핑과 같은 관용구.
      const spotIdMap = new Map<string, string>();
      for (const spot of original.spots) {
        const created = await tx.planSpot.create({
          data: {
            planId: plan.id, day: spot.day, order: spot.order, name: spot.name,
            lat: spot.lat, lng: spot.lng, spotId: spot.spotId,
          },
        });
        spotIdMap.set(spot.id, created.id);
      }
      for (const cost of original.costs) {
        await tx.planCost.create({
          data: {
            planId: plan.id,
            // 매핑에 없으면 null로 강등 = 기타 지출(라벨은 남는다). 모든 원본 항목을
            // 복사하므로 실제로는 도달하지 않지만, 끊긴 연결이 남의 id를 가리키느니 낫다.
            planSpotId: cost.planSpotId ? spotIdMap.get(cost.planSpotId) ?? null : null,
            day: cost.day,
            category: cost.category,
            label: cost.label,
            amount: cost.amount,
          },
        });
      }
      if (original.flight) {
        // planId가 @unique라 사본당 1행. 편도면 ret* 전부 null 그대로 넘어간다.
        await tx.planFlight.create({ data: { planId: plan.id, ...original.flight } });
      }
    });
  } catch {
    return { error: '복사 중 오류가 발생했습니다' };
  }

  redirect('/my-plan');
}
