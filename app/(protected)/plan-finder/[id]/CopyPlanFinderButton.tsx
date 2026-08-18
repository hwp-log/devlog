'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPlanCopyOrderAction } from './actions';

// 0603: 표시용 금액 문구. 실제 청구액의 정본은 lib/payment/price.ts의 PLAN_COPY_PRICE이고,
//   그 파일은 'server-only'라 여기서 import할 수 없다(클라이언트 번들 유입 차단이 목적).
//   **가격을 바꿀 때 두 곳을 함께 고칠 것** — 한쪽만 바꾸면 화면 금액과 청구 금액이 갈린다.
const PRICE_LABEL = '1,500원';

// 0515: variant='bar' — 모바일 하단 고정 바용 전폭 채움 버튼(시안 4d). 기본은 기존 인라인 그대로.
// 0603: 확인 단계 추가 — 클릭은 확인 UI를 열기만 하고, 주문 생성·결제창은 "결제하고 담기"에서 시작한다.
//   형태가 갈린다: variant='bar'(모바일) = 하단 시트 / 기본(데스크톱) = 버튼 자리 2단계 전환.
//   **새 미디어쿼리를 들이지 않는다** — 두 지점이 이미 CSS로 갈려 있어(PlanFinderDetail의
//   max-sm:hidden 래퍼 / sm:hidden 바) variant가 곧 뷰포트 분기다.
export function CopyPlanFinderButton({ planId, variant }: { planId: string; variant?: 'bar' }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  // 0599: 이동은 여기가 담당한다 — 액션은 값만 돌려준다(actions.ts 상단 주석).
  //   startTransition 안이라 작업이 끝날 때까지 isPending이 유지돼 버튼 비활성 표시가 산다.
  // 0601: 담기가 결제 뒤로 옮겨졌다 — 여기서는 **주문 저장 → 결제창 열기**까지만 한다.
  //   실제 복사(copyPublicPlanAction)는 승인 단계에서 서버가 호출한다(0602 /payment/confirm).
  const startPayment = () => {
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
        // 0603: 결제창을 닫으면 리다이렉트 없이 여기로 reject된다. **취소는 실패가 아니라
        //   정상 흐름**이라 안내하지 않고 확인 UI만 원상 복귀한다 — "결제를 시작하지
        //   못했습니다"는 사용자가 스스로 한 선택을 오류로 되돌려주는 말이었다.
        //   코드 문자열이 SDK 타입 정의에 열거돼 있지 않아(2.7.1 확인) 속성 접근으로 방어적으로 본다.
        if ((e as { code?: string } | null)?.code === 'PAY_PROCESS_CANCELED') {
          setConfirming(false);
          return;
        }
        // 그 외만 안내. 주문 행은 PENDING으로 남는다 — 승인되지 않은 주문이라 무해하고,
        //   정리 정책은 별건이다.
        console.error('[payment] requestPayment failed:', e);
        alert('결제를 시작하지 못했습니다');
      }
    });
  };

  // 0524: 흰 글자는 primary(#4d9eff) 면에서 대비 2.74:1로 WCAG AA(4.5) 미달이고
  // primary-fg(#0b1a2b)가 6.39:1이라 한때 primary-fg였다.
  // 0530: 그럼에도 primary 채움 버튼의 글자는 흰색으로 통일(사용자 확정, 0529 주요 버튼과 동일 선택) —
  // AA 미달을 알고 수용한다. 바꿀 땐 세 화면(작성 저장·MyPlan 새 계획·여기)을 함께.
  const BAR_BTN = 'w-full py-[14px] rounded-lg bg-primary text-white text-[15px] font-bold disabled:opacity-50';
  const INLINE_BTN = 'px-4 py-1.5 rounded-full text-sm border border-border text-fg2 hover:bg-surface2 transition-colors disabled:opacity-50';

  const trigger = (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={isPending}
      className={variant === 'bar' ? BAR_BTN : INLINE_BTN}
    >
      {/* 0603: 가격을 라벨에 노출 — 누르기 전에 유료임을 알린다(문구 정본은 위 PRICE_LABEL 주석) */}
      {isPending ? '결제 진행 중...' : `내 여행으로 담기 · ${PRICE_LABEL}`}
    </button>
  );

  // ── 모바일: 하단 시트 ──────────────────────────────────────────────────────
  // 0603: 셸 어휘는 기존 시트 2종(SpotFinderMapNaver:1161 · SpotMap:1381)과 동일 계열 —
  //   rounded-t-[22px] + border-border + shadow-2xl, pb에 safe-area 합산(CLAUDE.md §5).
  //   **높이 미지정 = 콘텐츠 높이.** svh를 쓰지 않는 이유: 58svh(0247)·70svh(0378)는
  //   "시트 아래로 지도가 계속 보여야 한다"는 요구에서 나온 값인데, 이 확인 시트는 뒤를 볼
  //   필요가 없어 그 규칙의 대상이 아니다.
  //   **스크림·바깥 클릭 닫기·ESC 없음** — 레포 관례(SpotMap:1370 "시트 밖 탭 = 닫힘 없음").
  //   닫기는 [취소]뿐이고, 시트가 담기 바를 물리적으로 덮어 뒤 버튼 오터치도 없다.
  //   z-[70] = globals.css 계층 지도의 신규 단계(담기 바 z-50 위). 다만 이 시트는
  //   PlanFinderDetail:521의 `fixed … z-50` div **안**에 있어 그 stacking context에 갇힌다 —
  //   이 화면엔 50을 넘는 레이어가 없어 결과는 의도대로지만, 값이 전역에서 그대로 통하진 않는다.
  if (variant === 'bar') {
    return (
      <>
        {trigger}
        {confirming && (
          <div className="fixed inset-x-0 bottom-0 z-[70] rounded-t-[22px] border border-border bg-card shadow-2xl px-4 pt-5 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <h2 className="text-[17px] font-bold text-fg break-keep">
              이 코스를 내 플랜으로 가져옵니다
            </h2>
            <p className="mt-2 text-sm text-fg2 break-keep">
              가져온 뒤 날짜·인원·금액을 자유롭게 고칠 수 있어요.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm text-fg2">결제 금액</span>
              <span className="text-[17px] font-bold text-fg tabular-nums">{PRICE_LABEL}</span>
            </div>
            {/* §5: 터치 타겟 44px 이상 + 인접 간격 8px 이상 */}
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={startPayment} disabled={isPending} className={BAR_BTN}>
                {isPending ? '결제 진행 중...' : '결제하고 담기'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="w-full py-[14px] rounded-lg border border-border text-fg2 text-[15px] font-semibold hover:bg-surface2 transition-colors disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── 데스크톱: 버튼 자리 2단계 전환 (레이어 없음) ────────────────────────────
  // 0603: 중앙 모달을 만들지 않는다 — FormatMenu.tsx:13의 기각 이력("모달 금지 —
  //   레이어 두 겹·모바일 답답함")과 같은 판단이다. 같은 자리에서 내용만 바뀐다.
  //   포커스는 [취소]에 — FormatMenu 확인 화면 관례("파괴적 확인은 안전한 쪽이 기본").
  //   ESC는 넣지 않는다(모바일 시트와 동일 규칙).
  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-fg2 whitespace-nowrap">{PRICE_LABEL}이 결제됩니다</span>
        <button
          type="button"
          autoFocus
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className={INLINE_BTN}
        >
          취소
        </button>
        <button
          type="button"
          onClick={startPayment}
          disabled={isPending}
          className="px-4 py-1.5 rounded-full text-sm font-bold bg-primary text-white disabled:opacity-50"
        >
          {isPending ? '결제 중...' : '결제'}
        </button>
      </div>
    );
  }

  return trigger;
}
