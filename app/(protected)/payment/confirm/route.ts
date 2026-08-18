import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { confirmPayment } from '@/lib/payment/confirm';
import { copyPublicPlanAction } from '@/app/(protected)/plan-finder/[id]/actions';

// 0602: 토스 successUrl의 목적지. **페이지가 아니라 Route Handler다.**
//   ① 결제 승인은 화면을 그리는 일이 아니라 부수효과다 — 돈이 움직이고 DB가 바뀐다.
//   ② 서버 컴포넌트 렌더에서는 애초에 불가능하다: copyPublicPlanAction이 마지막에
//      revalidatePath를 부르는데 Next 16은 렌더 단계의 revalidate 호출을 throw로 막는다
//      (next/dist/server/web/spec-extension/revalidate.js — phase === 'render').
//      Route Handler는 렌더 단계가 아니라 정상 동작한다.
//   ③ 클라이언트 진입(useEffect) 방식을 쓰지 않은 이유: 결제창에서 돌아오는 구간이
//      가장 불안정한데 JS가 안 뜨거나 사용자가 먼저 창을 닫으면 "돈은 나갔는데 승인이
//      안 된" 상태가 된다.
//   /payment/success는 결과 표시 전용으로 남는다.

// 0603: 리다이렉트는 전부 **303 See Other**. 기본값 307(NextResponse.redirect의
//   `?? 307`)은 **메서드를 보존**해서, POST로 도착한 콜백이 리다이렉트 뒤에도 히스토리에
//   POST로 남는다 → 성공 화면 새로고침이 POST /payment/confirm을 재전송하고, 이 라우트가
//   GET만 받으면 405가 난다("결제는 됐는데 화면은 실패"의 원인).
//   303은 후속 요청을 GET으로 강제하므로 히스토리에 GET이 남는다(표준 PRG).
const SEE_OTHER = 303;

function fail(request: NextRequest, code: string, message: string, planId?: string | null) {
  const url = new URL('/payment/fail', request.url);
  url.searchParams.set('code', code);
  url.searchParams.set('message', message);
  if (planId) url.searchParams.set('planId', planId);
  return NextResponse.redirect(url, SEE_OTHER);
}

// 0603: 토스는 successUrl로 **POST를 보낼 수 있다** — 기본은 GET이지만 일부 인앱
//   브라우저(웹뷰 제한)에서는 POST로 오고, 그때 값은 쿼리가 아니라 **form body**에 담긴다.
//   그래서 GET·POST가 같은 처리를 공유하고, 파라미터는 쿼리 우선 + 없으면 body에서 읽는다.
async function readCallbackParams(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  let form: FormData | null = null;
  if (request.method === 'POST') {
    form = await request.formData().catch(() => null);
  }
  const pick = (key: string) => q.get(key) ?? (form?.get(key)?.toString() ?? null);
  return {
    paymentKey: pick('paymentKey'),
    orderId: pick('orderId'),
    amountParam: pick('amount'),
  };
}

async function handle(request: NextRequest) {
  const { paymentKey, orderId, amountParam } = await readCallbackParams(request);

  // ① 돌아온 값 — 셋 중 하나라도 없으면 정상 콜백이 아니다.
  if (!paymentKey || !orderId || !amountParam) {
    return fail(request, 'INVALID_CALLBACK', '결제 정보가 올바르지 않습니다');
  }

  // ③ 소유자 확인의 전제. 세션이 없으면 **승인하지 않는다** — 아직 돈이 나가지 않은
  //   시점이라, 소유자를 확인하지 못한 채 승인하는 것보다 실패로 끝내는 편이 안전하다.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return fail(request, 'UNAUTHENTICATED', '로그인이 만료되어 결제를 승인하지 못했습니다');
  }

  // ② 주문 조회
  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) {
    return fail(request, 'ORDER_NOT_FOUND', '주문을 찾을 수 없습니다');
  }

  // ③ 남의 주문번호로 승인을 트리거하는 경로를 막는다.
  if (order.userId !== user.id) {
    return fail(request, 'FORBIDDEN', '본인의 주문이 아닙니다');
  }

  // ④ 이미 승인된 주문은 **다시 승인하지 않는다** — 새로고침·뒤로가기로 이 핸들러가
  //   두 번 실행될 수 있다. 사본 id를 따로 저장하지 않으므로 planId 없이 성공 화면으로
  //   보낸다(성공 페이지가 /my-plan 링크로 대체한다).
  if (order.status === 'PAID') {
    return NextResponse.redirect(new URL('/payment/success', request.url), SEE_OTHER);
  }

  // ⑤ 금액 대조 — 클라이언트가 돌려준 값과 **요청 시점에 서버가 정한 값**(0601)을 맞춘다.
  //   다르면 승인하지 않는다. 이 대조가 결제 금액 조작을 잡는 지점이다.
  const amount = Number(amountParam);
  if (!Number.isInteger(amount) || amount !== order.amount) {
    await prisma.order.update({ where: { orderId }, data: { status: 'FAILED' } });
    return fail(request, 'AMOUNT_MISMATCH', '결제 금액이 일치하지 않습니다', order.sourcePlanId);
  }

  // ⑥ 승인 요청 (재시도 없음 — lib/payment/confirm.ts 주석)
  const result = await confirmPayment({ paymentKey, orderId, amount });
  if (!result.ok) {
    await prisma.order.update({ where: { orderId }, data: { status: 'FAILED' } });
    return fail(request, result.code, result.message, order.sourcePlanId);
  }

  // ⑦ 승인 성공 기록
  await prisma.order.update({
    where: { orderId },
    data: { status: 'PAID', paymentKey, approvedAt: new Date() },
  });

  // ⑧ 실제 담기 — 0599에서 값 반환으로 바꾼 그 액션을 서버에서 그대로 재사용한다.
  const copied = await copyPublicPlanAction(order.sourcePlanId);
  if (!('planId' in copied)) {
    // **돈은 나갔는데 플랜이 없는 상태.** 환불 API는 이번 범위 밖이라 주문은 PAID로 남긴다 —
    //   수동 처리·환불 흐름을 붙일 근거가 DB에 남아야 하기 때문이다. 상태를 FAILED로
    //   되돌리면 "승인된 결제"라는 사실이 사라진다.
    return fail(
      request,
      'COPY_FAILED',
      '결제는 완료되었으나 플랜을 담지 못했습니다. 고객센터로 문의해 주세요',
      order.sourcePlanId,
    );
  }

  // ⑨ 결과 안내 — 담은 플랜으로 가는 링크를 성공 페이지가 그린다.
  const url = new URL('/payment/success', request.url);
  url.searchParams.set('planId', copied.planId);
  return NextResponse.redirect(url, SEE_OTHER);
}

// 0603: GET·POST 모두 같은 처리. POST를 안 받으면 인앱 브라우저 콜백과
//   새로고침 재전송이 405로 떨어진다.
export const GET = handle;
export const POST = handle;
