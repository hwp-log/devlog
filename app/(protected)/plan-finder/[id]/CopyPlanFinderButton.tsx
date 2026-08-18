'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPlanCopyOrderAction } from './actions';

// 0515: variant='bar' — 모바일 하단 고정 바용 전폭 채움 버튼(시안 4d). 기본은 기존 인라인 그대로.
export function CopyPlanFinderButton({ planId, variant }: { planId: string; variant?: 'bar' }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // 0599: 이동은 여기가 담당한다 — 액션은 값만 돌려준다(actions.ts 상단 주석).
  //   startTransition 안이라 작업이 끝날 때까지 isPending이 유지돼 버튼 비활성 표시가 산다.
  // 0601: 담기가 결제 뒤로 옮겨졌다 — 여기서는 **주문 저장 → 결제창 열기**까지만 한다.
  //   실제 복사(copyPublicPlanAction)는 승인 단계에서 서버가 호출한다(다음 커밋).
  const handleCopy = () => {
    startTransition(async () => {
      const order = await createPlanCopyOrderAction(planId);
      if ('unauthenticated' in order) { router.push('/login'); return; }
      if ('error' in order) { alert(order.error); return; }

      try {
        // 0601: SDK는 클릭 시점에 동적 import — 상세 페이지 초기 번들에 결제 코드를 싣지 않는다.
        const { loadTossPayments, ANONYMOUS } = await import('@tosspayments/tosspayments-sdk');
        const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
        // 0601: customerKey는 빌링키·브랜드페이처럼 **재사용되는 결제수단을 고객과 매핑**할 때
        //   쓰는 값이다. 카드 단건 결제에는 저장할 결제수단이 없어 지금 넘겨도 쓰이는 곳이 없다.
        //   자동결제·브랜드페이를 붙이게 되면 그때 실제 customerKey로 바꾼다.
        const payment = toss.payment({ customerKey: ANONYMOUS });

        await payment.requestPayment({
          method: 'CARD',
          // v2의 amount는 숫자가 아니라 객체다. 값은 **서버가 정해 내려준 것**을 그대로 쓴다 —
          // 클라이언트가 금액을 만들면 승인 단계의 금액 대조가 무의미해진다.
          amount: { currency: 'KRW', value: order.amount },
          orderId: order.orderId,
          orderName: order.orderName,
          // 오리진 포함 절대 URL이 필수(SDK 제약). 돌아올 때 쿼리가 붙는다 —
          //   성공: ?amount=&orderId=&paymentKey=  /  실패: ?code=&message=&orderId=
          successUrl: `${window.location.origin}/payment/confirm`,
          failUrl: `${window.location.origin}/payment/failed`,
        });
      } catch (e) {
        // 사용자가 결제창을 닫은 경우도 여기로 온다(리다이렉트 없이 reject).
        //   주문 행은 PENDING으로 남는다 — 승인되지 않은 주문이라 무해하고,
        //   정리 정책은 승인 흐름을 붙인 뒤 판단한다.
        console.error('[payment] requestPayment failed:', e);
        alert('결제를 시작하지 못했습니다');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isPending}
      className={
        variant === 'bar'
          // 0524: 흰 글자는 primary(#4d9eff) 면에서 대비 2.74:1로 WCAG AA(4.5) 미달이고
          // primary-fg(#0b1a2b)가 6.39:1이라 한때 primary-fg였다.
          // 0530: 그럼에도 primary 채움 버튼의 글자는 흰색으로 통일(사용자 확정, 0529 주요 버튼과 동일 선택) —
          // AA 미달을 알고 수용한다. 바꿀 땐 세 화면(작성 저장·MyPlan 새 계획·여기)을 함께.
          ? 'w-full py-[14px] rounded-lg bg-primary text-white text-[15px] font-bold disabled:opacity-50'
          : 'px-4 py-1.5 rounded-full text-sm border border-border text-fg2 hover:bg-surface2 transition-colors disabled:opacity-50'
      }
    >
      {isPending ? '결제 진행 중...' : '내 여행으로 담기'}
    </button>
  );
}
