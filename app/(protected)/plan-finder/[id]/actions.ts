'use server';
import { visiblePlanWhere } from '@/lib/plan/queries';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { PLAN_COPY_PRICE } from '@/lib/payment/price';

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

// 0599: 담기 결과를 **값으로** 돌려준다. 셋을 섞지 않는 것이 요점 —
//   planId = 성공(새 사본 id) / unauthenticated = 제어 신호 / error = 표시용 메시지.
//   이 액션은 redirect를 던지지 않는다: 결제 승인 뒤 서버에서 담기를 부를 때
//   NEXT_REDIRECT가 throw로 튀면 "승인은 됐는데 담기가 됐는지"를 판정할 수 없다.
//   화면 이동은 호출부(CopyPlanFinderButton)가 router.push로 담당한다.
export type CopyPublicPlanResult =
  | { planId: string }
  | { unauthenticated: true }
  | { error: string };

export async function copyPublicPlanAction(
  planId: string,
): Promise<CopyPublicPlanResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { unauthenticated: true };

  // 0557: 공개이거나 내 것 — 자기 비공개 담기는 무해(버튼은 isOwner 숨김, 방어만 공유)
  const original = await prisma.myPlan.findFirst({
    where: { id: planId, ...visiblePlanWhere(user.id) },
    select: {
      title: true,
      description: true,
      region: true,
      movie: true,
      currency: true,
      // 0582: startDate·endDate는 복사하지 않는다 — 0579에서 넣었다가 되돌렸다.
      //   담기가 가져오는 건 **Day 구조**(며칠짜리로 어떻게 도느냐)이고, 실제 날짜는 담은
      //   사람이 자기 일정에 맞춰 지정하는 값이다. 원본 날짜를 실어 오면 지난 여행을 담았을 때
      //   과거 날짜가 그대로 유입돼 0581에서 막은 것이 담기로 우회된다.
      //   0579가 날짜를 복사한 이유(빼면 Day 1만 보임)는 dayCount 3단 폴백(0582 lib/plan/day-count.ts)
      //   으로 해소됐다 — 날짜 없이도 PlanSpot의 최대 day로 Day 구조가 산다.
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
      costs: {
        // 0588: order도 함께 복사한다 — **원본 작성자가 정한 순서를 유지**한다(사용자 확정).
        //   담기는 "이 사람이 짠 것"을 가져오는 것이므로 비용 배열의 순서도 그 일부다.
        //   재번호 없이 그대로 실어도 그룹(day)별 0..n-1이 보존된다 — 원본이 이미 그 형태고
        //   행을 걸러내지 않고 전량 복사하기 때문.
        select: { planSpotId: true, day: true, order: true, category: true, label: true, amount: true },
      },
      // 0580: PlanFlight는 복사하지 않는다 — 0579에서 한 번 넣었다가 되돌렸다.
      //   ① 항공권은 **특정 편명·특정 시각의 예약**이라 담은 사람이 그대로 쓸 수 없다.
      //      비용·일정은 "이렇게 다녀왔다"는 참고값이지만 편명은 참고가 되지 않는다.
      //   ② 가격이 매일 바뀌므로 원본 시점 금액이 남아 있으면 오해를 부른다 —
      //      비용 주의 문구로 덮을 수 있는 오차의 폭이 아니다.
      //   담은 사람은 자기 날짜로 다시 검색하는 게 맞고, 그 경로(작성 폼의 "항공편 검색")는
      //   이미 있다. 0103이 항공을 언급조차 안 했던 건 사실이나, 지금 판단으로도 제외가 맞다.
    },
  });

  if (!original) return { error: '원본 플랜을 찾을 수 없습니다' };

  let newPlanId: string;
  try {
    newPlanId = await prisma.$transaction(async (tx) => {
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
          headcount: original.headcount,
          // 0594: 담은 시점의 비용 총액 스냅샷. 비용 주의 배너를 "금액을 실제로 고쳤는가"로
          //   판정하기 위한 비교 기준이다(판정 적용은 별도 커밋 — 여기선 기록만).
          //   별도 조회가 없다 — original.costs는 위 findFirst 결과이고, 아래 복사 루프가
          //   행을 거르지 않으므로 **이 합 = 사본 PlanCost 합**이 성립한다(0594 조사 확인).
          //   PlanFlight는 넣지 않는다: 담기가 항공을 복사하지 않으므로(0580) 담은 시점 값이
          //   늘 0이고, 담은 사람이 나중에 항공권을 붙이면 "비용을 안 고쳤는데" 총액이 바뀐다.
          //   create가 tx 안이라 실패 시 스냅샷도 함께 롤백된다.
          sourceCostTotal: original.costs.reduce((sum, c) => sum + c.amount, 0),
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
            order: cost.order, // 0588: 원본 순서 유지
            category: cost.category,
            label: cost.label,
            amount: cost.amount,
          },
        });
      }
      return plan.id;
    });
  } catch {
    return { error: '복사 중 오류가 발생했습니다' };
  }

  // 0599: 지금까지 목록 갱신은 이 액션의 redirect('/my-plan')가 부수적으로 맡고 있었다.
  //   이동이 클라이언트(router.push)로 넘어가면 Client Cache의 stale한 목록이 그대로
  //   그려질 수 있어 명시적으로 무효화한다(같은 처리: my-plan/[id]/actions.ts).
  revalidatePath('/my-plan');
  return { planId: newPlanId };
}

// 0601: 담기 결제의 주문 생성. 결제창을 띄우기 **전에** 서버가 먼저 주문을 남긴다 —
//   승인 단계에서 successUrl로 돌아온 amount를 이 행의 amount와 대조해야 하기 때문이다(0600).
//   반환은 0599와 같은 결: redirect를 던지지 않고 값만 돌려준다.
//   **금액도 주문명도 서버가 정해 내려보낸다** — 클라이언트는 받은 값을 SDK에 그대로 넘길 뿐이고,
//   클라이언트가 보낸 금액을 주문에 쓰면 대조 자체가 무의미해진다.
export type CreatePlanOrderResult =
  | { orderId: string; amount: number; orderName: string }
  | { unauthenticated: true }
  | { error: string };

export async function createPlanCopyOrderAction(
  sourcePlanId: string,
): Promise<CreatePlanOrderResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { unauthenticated: true };

  // copyPublicPlanAction과 **같은 게이트**(visiblePlanWhere) — 담을 수 없는 플랜에
  //   주문이 생기면 결제는 되고 담기는 실패하는 상태가 만들어진다.
  const plan = await prisma.myPlan.findFirst({
    where: { id: sourcePlanId, ...visiblePlanWhere(user.id) },
    select: { title: true },
  });
  if (!plan) return { error: '원본 플랜을 찾을 수 없습니다' };

  // 토스 orderId 제약: 영문 대소문자·숫자·'-'·'_'·'='로 이루어진 6~64자.
  //   randomUUID는 36자 hex+하이픈이라 제약 안이고, Node 내장이라 의존성이 늘지 않는다.
  const orderId = crypto.randomUUID();
  // orderName은 결제창·영수증에 뜨는 문구. SDK 상한 100자에 맞춰 자른다.
  const orderName = `여행 플랜 담기 - ${plan.title}`.slice(0, 100);

  try {
    await prisma.order.create({
      data: {
        orderId,
        userId: user.id,
        sourcePlanId,
        amount: PLAN_COPY_PRICE, // 산출 정본은 lib/payment/price.ts 하나뿐
        status: 'PENDING',
      },
    });
  } catch {
    return { error: '주문 생성에 실패했습니다' };
  }

  return { orderId, amount: PLAN_COPY_PRICE, orderName };
}
