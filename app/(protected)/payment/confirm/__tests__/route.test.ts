/**
 * @jest-environment node
 *
 * 결제 승인 라우트 검증. 전역 jest 환경(jsdom)에는 fetch API의 Request/Response
 * 전역이 없어 NextRequest/NextResponse가 생성 시점에 죽는다 — 이 파일만 node로 돈다.
 */
import { NextRequest } from 'next/server';

const mockGetUser = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ auth: { getUser: mockGetUser } })
  ),
}));

// jest.mock은 import·const 위로 호이스팅되므로 factory에서 바깥 const를 참조하면
// 초기화 전 접근이 된다 — factory 안에서 jest.fn()을 만들고 requireMock으로 꺼낸다.
jest.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: jest.fn(), update: jest.fn() } },
}));
jest.mock('@/lib/payment/confirm', () => ({ confirmPayment: jest.fn() }));
jest.mock('@/app/(protected)/plan-finder/[id]/actions', () => ({
  copyPublicPlanAction: jest.fn(),
}));

const mockFindUnique = jest.requireMock('@/lib/prisma').prisma.order.findUnique as jest.Mock;
const mockUpdate = jest.requireMock('@/lib/prisma').prisma.order.update as jest.Mock;
const mockConfirmPayment = jest.requireMock('@/lib/payment/confirm').confirmPayment as jest.Mock;
const mockCopyPlan = jest.requireMock('@/app/(protected)/plan-finder/[id]/actions')
  .copyPublicPlanAction as jest.Mock;

import { GET } from '../route';

const ORDER_ID = 'order-uuid-1';

const pendingOrder = {
  id: 'row-1',
  orderId: ORDER_ID,
  userId: 'user-1',
  sourcePlanId: 'plan-1',
  amount: 1500,
  status: 'PENDING',
  paymentKey: null,
};

function callbackRequest(amount: number | string) {
  const url = new URL('http://localhost:3000/payment/confirm');
  url.searchParams.set('paymentKey', 'pay-key-1');
  url.searchParams.set('orderId', ORDER_ID);
  url.searchParams.set('amount', String(amount));
  return new NextRequest(url);
}

function locationOf(res: Response) {
  const location = res.headers.get('location');
  expect(location).not.toBeNull();
  return new URL(location as string);
}

beforeEach(() => {
  jest.clearAllMocks();
  // happy-path 기본값 — 각 케이스가 어긋나는 값만 덮어쓴다
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mockFindUnique.mockResolvedValue({ ...pendingOrder });
  mockUpdate.mockResolvedValue({});
  mockConfirmPayment.mockResolvedValue({ ok: true });
  mockCopyPlan.mockResolvedValue({ planId: 'copied-plan-1' });
});

describe('결제 승인 라우트 — 승인 차단 경로 (confirmPayment 미호출)', () => {
  it('금액 불일치(적게 보낸 위조): 승인 없이 주문을 FAILED로 내리고 AMOUNT_MISMATCH로 보낸다', async () => {
    const res = await GET(callbackRequest(100)); // DB 금액은 1500

    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
    const url = locationOf(res);
    expect(res.status).toBe(303);
    expect(url.pathname).toBe('/payment/fail');
    expect(url.searchParams.get('code')).toBe('AMOUNT_MISMATCH');
  });

  it('이미 PAID인 주문: 재승인 없이 성공 화면으로 보내고 상태를 건드리지 않는다', async () => {
    mockFindUnique.mockResolvedValue({ ...pendingOrder, status: 'PAID' });

    const res = await GET(callbackRequest(1500));

    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(res.status).toBe(303);
    expect(url.pathname).toBe('/payment/success');
  });

  it('남의 주문: 승인 없이 FORBIDDEN으로 막고 상태를 건드리지 않는다', async () => {
    mockFindUnique.mockResolvedValue({ ...pendingOrder, userId: 'other-user' });

    const res = await GET(callbackRequest(1500));

    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/payment/fail');
    expect(url.searchParams.get('code')).toBe('FORBIDDEN');
  });

  it('로그인 안 함: DB 조회조차 가지 않고 실패로 보낸다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET(callbackRequest(1500));

    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/payment/fail');
    expect(url.searchParams.get('code')).toBe('UNAUTHENTICATED');
  });
});

describe('결제 승인 라우트 — 승인 이후 경로 (confirmPayment 호출)', () => {
  it('담기 실패: 주문은 PAID로 남고 FAILED로 되돌리지 않는다', async () => {
    mockCopyPlan.mockResolvedValue({ error: '담기 실패' });

    const res = await GET(callbackRequest(1500));

    expect(mockConfirmPayment).toHaveBeenCalledTimes(1);
    // 마지막 상태 갱신이 PAID — 이후 FAILED 덮어쓰기가 없어야 승인 사실이 DB에 남는다
    const lastUpdate = mockUpdate.mock.calls.at(-1)?.[0];
    expect(lastUpdate?.data?.status).toBe('PAID');
    expect(
      mockUpdate.mock.calls.some((call) => call[0]?.data?.status === 'FAILED')
    ).toBe(false);
    const url = locationOf(res);
    expect(url.pathname).toBe('/payment/fail');
    expect(url.searchParams.get('code')).toBe('COPY_FAILED');
  });

  it('승인 실패(ok:false): 주문을 FAILED로 내리고 결제사 code·message를 그대로 실어 보낸다', async () => {
    mockConfirmPayment.mockResolvedValue({
      ok: false,
      code: 'REJECT_CARD',
      message: '한도 초과',
    });

    const res = await GET(callbackRequest(1500));

    expect(mockConfirmPayment).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
    const url = locationOf(res);
    expect(url.pathname).toBe('/payment/fail');
    expect(url.searchParams.get('code')).toBe('REJECT_CARD');
    expect(url.searchParams.get('message')).toBe('한도 초과');
  });
});
