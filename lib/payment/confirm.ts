import 'server-only';

// 0602: 토스 결제 승인. **여기서만 TOSS_SECRET_KEY를 읽는다** — 클라이언트 번들에
//   시크릿이 실릴 경로를 'server-only'로 컴파일 단계에서 막는다.
const CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';
// 카드사 통신이 끼어 있어 항공권 검색(lib/flights/client.ts, 15s)보다 길게 잡는다.
const TIMEOUT_MS = 30_000;

export type ConfirmResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function authHeader() {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error('TOSS_SECRET_KEY missing');
  // 시크릿 키 **뒤에 콜론**을 붙이고 base64. 비밀번호가 빈 Basic 인증 형식이라
  //   콜론을 빠뜨리면 키가 맞아도 인증에 실패한다.
  return `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;
}

/**
 * 0602: 승인 요청. **재시도하지 않는다.**
 *   응답을 못 받아도 **승인은 됐을 수 있다** — 타임아웃·네트워크 끊김은 "실패"가 아니라
 *   "결과를 모름"이다. 여기서 다시 부르면 이중 결제가 된다. 실패로 처리하고 사람이
 *   확인하는 편이 낫다.
 *   같은 파일 계열인 lib/flights/client.ts의 429 재귀 재시도를 여기 베끼지 말 것 —
 *   검색은 다시 불러도 아무 일도 일어나지 않지만 승인은 돈이 움직인다.
 *
 *   Idempotency-Key(= orderId): 재시도가 아니라 **중복 요청 방어**다. 우리 DB의 PAID
 *   가드는 두 요청이 거의 동시에 들어오면 뚫린다(둘 다 PENDING을 읽고 둘 다 승인을 부른다).
 *   같은 키로 들어온 요청은 재실행 없이 같은 응답을 돌려주므로 방어가 우리 쪽과 결제사 쪽
 *   두 겹이 된다. DB 가드는 그대로 둔다 — 불필요한 외부 호출을 줄이는 역할이 따로 있다.
 *
 *   에러를 throw하지 않고 값으로 돌려주는 이유: 호출부가 주문 상태를 FAILED로 정리하고
 *   사용자에게 사유를 보여야 하므로 code·message가 필요하다.
 */
export async function confirmPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<ConfirmResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        'Idempotency-Key': params.orderId,
      },
      body: JSON.stringify({
        paymentKey: params.paymentKey,
        orderId: params.orderId,
        amount: params.amount,
      }),
      signal: ctrl.signal,
      // Next 캐시 옵션(next: { revalidate })을 쓰지 않는다 — 승인은 캐시 대상이 아니다.
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { code?: string; message?: string }
        | null;
      return {
        ok: false,
        code: body?.code ?? `HTTP_${res.status}`,
        message: body?.message ?? '결제 승인에 실패했습니다',
      };
    }

    return { ok: true };
  } catch (e) {
    // AbortError(타임아웃) 포함. **여기서 다시 부르지 않는다**(위 주석 참조).
    console.error('[payment] confirm failed:', e);
    return {
      ok: false,
      code: 'CONFIRM_REQUEST_FAILED',
      message: '결제 승인 요청을 완료하지 못했습니다',
    };
  } finally {
    clearTimeout(timer);
  }
}
