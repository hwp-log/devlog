import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// 0602: 토스 failUrl의 목적지. 승인 쪽(/payment/confirm)과 같은 이유로 페이지가 아니라
//   Route Handler다 — 주문 상태를 FAILED로 정리하는 건 화면을 그리는 일이 아니다.
//   돌아오는 쿼리: ?code=&message=&orderId= (orderId는 일부 실패 유형에만 붙는다)
// 0603: 승인 쪽(/payment/confirm)과 대칭 — 303 리다이렉트 + GET·POST 공용.
//   근거는 그쪽 SEE_OTHER 주석 참조(307은 메서드를 보존해 새로고침이 POST를 재생한다).
const SEE_OTHER = 303;

async function handle(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const form = request.method === 'POST' ? await request.formData().catch(() => null) : null;
  const pick = (key: string) => q.get(key) ?? (form?.get(key)?.toString() ?? null);

  const code = pick('code') ?? 'UNKNOWN';
  const message = pick('message') ?? '결제가 완료되지 않았습니다';
  const orderId = pick('orderId');

  let sourcePlanId: string | null = null;

  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { orderId },
      select: { sourcePlanId: true },
    });
    sourcePlanId = order?.sourcePlanId ?? null;

    // **PENDING인 행만** FAILED로 내린다 — 이미 PAID인 주문을 실패로 덮지 않기 위해서다
    //   (승인 후 이 URL로 다시 들어오는 경우가 있어도 결제 사실이 지워지면 안 된다).
    //   updateMany라 조건에 안 맞으면 0건 갱신으로 조용히 지나간다.
    await prisma.order.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }

  const url = new URL('/payment/fail', request.url);
  url.searchParams.set('code', code);
  url.searchParams.set('message', message);
  if (sourcePlanId) url.searchParams.set('planId', sourcePlanId);
  return NextResponse.redirect(url, SEE_OTHER);
}

export const GET = handle;
export const POST = handle;
