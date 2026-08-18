'use client';
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPlanCopyOrderAction } from './actions';

// 0603: 표시용 금액 문구. 실제 청구액의 정본은 lib/payment/price.ts의 PLAN_COPY_PRICE이고,
//   그 파일은 'server-only'라 여기서 import할 수 없다(클라이언트 번들 유입 차단이 목적).
//   **가격을 바꿀 때 두 곳을 함께 고칠 것** — 한쪽만 바꾸면 화면 금액과 청구 금액이 갈린다.
const PRICE_LABEL = '1,500원';

// 0524: 흰 글자는 primary(#4d9eff) 면에서 대비 2.74:1로 WCAG AA(4.5) 미달이고
// primary-fg(#0b1a2b)가 6.39:1이라 한때 primary-fg였다.
// 0530: 그럼에도 primary 채움 버튼의 글자는 흰색으로 통일(사용자 확정, 0529 주요 버튼과 동일 선택) —
// AA 미달을 알고 수용한다. 바꿀 땐 세 화면(작성 저장·MyPlan 새 계획·여기)을 함께.
const BAR_BTN = 'w-full py-[14px] rounded-lg bg-primary text-white text-[15px] font-bold disabled:opacity-50';
const INLINE_BTN = 'px-4 py-1.5 rounded-full text-sm border border-border text-fg2 hover:bg-surface2 transition-colors disabled:opacity-50';

// 0605: 시트 열기·닫기 시간. SpotMap:130(SHEET_OPEN_MS 320 / SHEET_CLOSE_MS 240)과 같은 계열 —
//   레포의 시트 질감을 하나로 유지한다. 값을 바꿀 땐 그쪽과 함께 볼 것.
const SHEET_OPEN_MS = 320;
const SHEET_CLOSE_MS = 240;
const SHEET_EASING = 'cubic-bezier(0.32,0.72,0,1)';
// jsdom엔 matchMedia가 없어 가드(SpotMap:128과 동형) — 테스트는 애니 있는 경로로 렌더.
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 0515: variant='bar' — 모바일 하단 고정 바용 전폭 채움 버튼(시안 4d). 기본은 기존 인라인 그대로.
// 0605: **트리거 전용으로 축소.** 확인 시트와 결제 실행은 아래 CopyPlanConfirmSheet가 맡는다.
//   이유: 트리거가 2개(데스크톱 인라인·모바일 바)인데 둘 다 마운트되므로(CSS로만 가림),
//   상태를 버튼 안에 두면 **시트가 2벌** 생긴다. 상태는 호스트(PlanFinderDetail)가 갖는다.
export function CopyPlanFinderButton({
  variant,
  onRequest,
}: { variant?: 'bar'; onRequest: () => void }) {
  return (
    <button
      type="button"
      onClick={onRequest}
      className={variant === 'bar' ? BAR_BTN : INLINE_BTN}
    >
      여행계획 담기
    </button>
  );
}

// 0605: 확인 시트 — **담기 바 밖**, 호스트 루트에 1개만 렌더된다.
//   0603에서는 이 시트가 담기 바(`fixed … z-50`) 안에 있어 z-[70]이 그 stacking context에
//   갇혔는데, 바 밖으로 나오면서 해소됐다(호스트 래퍼는 transform·z-index가 없어 컨텍스트를
//   만들지 않는다). 데스크톱에도 담기 바가 없으므로 이 위치라야 두 화면이 같은 시트를 쓴다.
//
//   셸 어휘는 기존 시트 2종(SpotFinderMapNaver:1161 · SpotMap:1381)과 동일 계열 —
//   rounded-t-[22px] + border-border + shadow-2xl, pb에 safe-area 합산(CLAUDE.md §5).
//   **높이 미지정 = 콘텐츠 높이.** svh를 쓰지 않는 이유: 58svh(0247)·70svh(0378)는
//   "시트 아래로 지도가 계속 보여야 한다"는 요구에서 나온 값인데, 이 확인 시트는 뒤를 볼
//   필요가 없어 그 규칙의 대상이 아니다.
//   **바깥 클릭 닫기·ESC 없음** — 레포 관례(SpotMap:1370 "시트 밖 탭 = 닫힘 없음"). 닫기는 [취소]뿐.
export function CopyPlanConfirmSheet({
  planId,
  open,
  onClose,
}: { planId: string; open: boolean; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // 0605: 닫힘 애니를 보이려면 닫는 동안 마운트를 유지해야 한다(SpotMap의 closingSpot과 같은 구조).
  const [closing, setClosing] = useState(false);
  // 0606: 실패 안내는 브라우저 alert 대신 시트 안 한 줄로 — 시트가 이미 떠 있으므로
  //   그 안에서 말하는 것이 문맥에 맞고, alert는 시트·스크림 위에 이질적인 레이어를 얹는다.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const phaseRef = useRef<'open' | 'close' | null>(null);

  // 0599: 이동은 여기가 담당한다 — 액션은 값만 돌려준다(actions.ts 상단 주석).
  //   startTransition 안이라 작업이 끝날 때까지 isPending이 유지돼 버튼 비활성 표시가 산다.
  // 0601: 담기가 결제 뒤로 옮겨졌다 — 여기서는 **주문 저장 → 결제창 열기**까지만 한다.
  //   실제 복사(copyPublicPlanAction)는 승인 단계에서 서버가 호출한다(0602 /payment/confirm).
  const startPayment = () => {
    setErrorMsg(null); // 재시도 진입 시 이전 오류 지움
    startTransition(async () => {
      const order = await createPlanCopyOrderAction(planId);
      if ('unauthenticated' in order) { router.push('/login'); return; }
      if ('error' in order) { setErrorMsg(order.error); return; }

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
        // 0603→0606: 결제창을 닫으면 리다이렉트 없이 여기로 reject된다. **취소는 실패가 아니라
        //   정상 흐름**이라 안내하지 않고 시트만 닫는다.
        //
        //   판정은 배포 SDK(https://js.tosspayments.com/v2/standard) 원문에서 확인한
        //   실제 에러 형태 기준(0606 실측 — 0603의 PAY_PROCESS_CANCELED는 **failUrl 쿼리
        //   코드**지 reject 코드가 아니었다. 스크립트 전체에서 그 코드로 에러를 만드는 곳 0건):
        //   형태 A(결제창 v2): name='UserCancelError', message='취소되었습니다.', code 없음
        //   형태 B(위젯 계열): name='Error', message='취소되었습니다.', code='USER_CANCEL'
        //   메시지 검사는 원격 스크립트 개정 대비 최후망 — 두 형태 모두 같은 메시지 상수를 쓴다.
        const err = e as { code?: string; name?: string; message?: string } | null;
        const canceled =
          err?.code === 'USER_CANCEL' ||
          err?.name === 'UserCancelError' ||
          (err?.message?.includes('취소되었습니다') ?? false);
        if (canceled) {
          startClose();
          return;
        }
        // 그 외만 안내(시트 안 한 줄 — alert 아님). 주문 행은 PENDING으로 남는다 —
        //   승인되지 않은 주문이라 무해하고, 정리 정책은 별건이다.
        console.error('[payment] requestPayment failed:', e);
        setErrorMsg('결제를 시작하지 못했습니다');
      }
    });
  };

  // 0605: 닫기는 **핸들러에서 시작한다** — 호스트의 open을 먼저 내리면 노드가 사라져 닫힘
  //   애니를 재생할 수 없다. closing=true로 애니를 돌리고, 끝난 뒤 onClose()로 호스트를 닫는다.
  //   reduced-motion이면 애니 없이 즉시 닫는다.
  const startClose = () => {
    setErrorMsg(null); // 닫았다 다시 열면 깨끗한 시트
    if (prefersReduced()) { onClose(); return; }
    setClosing(true);
  };

  // 0605: 슬라이드는 WAAPI로 — 노드 재사용 상태에서 animation-name 교체가 재시작되지 않는
  //   iOS Safari 거동을 우회한다(el.animate는 명시적 재생). SpotMap:392의 관용구를 그대로 이식했다.
  //   useLayoutEffect = 첫 paint 전 시작(열릴 때 아래에서 시작하지 않고 번쩍이는 것 방지).
  //   reduced-motion이면 애니 없이 즉시 표시/제거한다.
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el || !open) return;
    const dir = closing ? 'close' : 'open';
    if (phaseRef.current === dir) return; // 같은 방향 중복 재생 방지
    phaseRef.current = dir;
    if (prefersReduced()) return;

    animRef.current?.cancel(); // 진행 중 애니 취소 후 새로 시작(연타 인터럽트)
    const frames: Keyframe[] = dir === 'open'
      ? [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }]
      : [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }];
    const duration = dir === 'open' ? SHEET_OPEN_MS : SHEET_CLOSE_MS;
    const anim = el.animate(frames, { duration, easing: SHEET_EASING, fill: 'forwards' });
    animRef.current = anim;
    // 스크림은 같은 시간에 맞춰 페이드 — 시트만 움직이면 배경이 툭 바뀐다.
    scrimRef.current?.animate(
      dir === 'open' ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
      { duration, easing: SHEET_EASING, fill: 'forwards' },
    );
    // cancel(인터럽트·언마운트)은 reject되므로 catch로 흡수한다(unhandled rejection 방지).
    if (dir === 'close') {
      anim.finished.then(() => { setClosing(false); onClose(); }).catch(() => {});
    } else {
      anim.finished.catch(() => {});
    }
  }, [open, closing, onClose]);

  // 닫힌 뒤 방향 기록을 비운다 — 다음 열기에서 'open'이 새 방향으로 인식돼야 재생된다.
  useEffect(() => { if (!open) phaseRef.current = null; }, [open]);
  useEffect(() => () => { animRef.current?.cancel(); }, []);

  if (!open) return null;

  return (
    // 0605: 스크림 + 시트를 한 겹(z-[70]) 안에 담는다 — 계층 지도에 값이 하나만 늘어난다.
    //   **스크림을 넣은 이유**: 기존 시트 둘(SpotFinderMapNaver·SpotMap)에 스크림이 없는 건
    //   뒤(지도)를 계속 보고 조작해야 하는 화면이라서다(standard sheet). 결제 확인은 결정
    //   지점이라 뒤를 조작할 이유가 없고, 확인이 떠 있는 동안 뒤의 좋아요·링크가 눌리는 게
    //   오히려 사고다(modal sheet). **다만 클릭으로 닫지는 않는다** — 닫기는 [취소]뿐이라는
    //   레포 관례(SpotMap:1370)는 유지한다. 스크림은 어둡게 + 포인터 차단 역할만 한다.
    <div className="fixed inset-0 z-[70]">
      <div ref={scrimRef} className="absolute inset-0 bg-black/40" aria-hidden />
      {/* 0605: **데스크톱에도 시트를 쓴다 — 표준과 다른 선택이라 근거를 남긴다.**
          Material은 "modal bottom sheet는 작은 화면에서 가장 효과적이고, 큰 화면에서는 메뉴·
          다이얼로그로 트리거와의 시각적 연결을 만들라"고 권한다. shadcn 계열 실무도 모바일
          Drawer / 데스크톱 Dialog로 가른다. 그럼에도 시트인 이유:
          ① 이 화면 전체가 면·여백 기반이라 가운데 모달은 **그 위에 상자를 얹는 것**이고
             시트는 바닥에서 밀려 올라오는 것이다 — 후자가 이 레포의 결이다.
          ② 레포에 시트 어휘가 이미 서 있다(rounded-t-[22px]·WAAPI 320/240·reduced-motion).
             모달 셸은 0건이고 FormatMenu.tsx:13엔 모달을 기각한 이력이 있다.
          ③ Material의 근거인 "트리거와의 시각적 연결"이 여기선 세게 걸리지 않는다 —
             담기 버튼이 상단 액션 행에 있어 어차피 트리거와 확인이 붙어 있지 않다. */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 rounded-t-[22px] border border-border bg-card shadow-2xl px-4 pt-5 pb-[calc(16px+env(safe-area-inset-bottom))]"
      >
        {/* 0605: 시트는 가로 전체, 내용만 가운데 고정 폭. --reading-w(860)를 쓰지 않는다 —
            이건 읽기 콘텐츠가 아니라 결정 블록이고, 860이면 두 줄짜리 문구가 늘어진다.
            420 = 모바일 시트 실폭(360~390 − 좌우 패딩 32 = 328~358)에 가깝게 잡아 두 화면의
            조판이 같은 덩어리로 보이게 하는 값. */}
        <div className="mx-auto w-full max-w-[420px]">
          {/* 0605: "커피 한 잔 값" — 메가커피 핫 아메리카노 1,700원 기준으로 1,500원이 그보다 낮다.
              금액을 숫자로만 보이면 비교 기준이 없어 비싼지 싼지 판단할 근거가 안 생긴다. */}
          <h2 className="text-[17px] font-bold text-fg break-keep">
            커피 한 잔 값으로
          </h2>
          <p className="mt-2 text-sm text-fg2 break-keep">
            담아서 내 일정에 맞게 고칠 수 있어요.
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-fg2">결제 금액</span>
            <span className="text-[17px] font-bold text-fg tabular-nums">{PRICE_LABEL}</span>
          </div>
          {/* 0606: 실패 안내 — alert 대신 시트 안 한 줄. 위치는 금액 행과 버튼 사이:
              오류는 "결제하고 담기"를 누른 결과라 그 버튼 바로 위가 원인-결과로 읽힌다.
              text-danger = 레포 오류 축 토큰(0477). role="alert" = 동적 삽입 통지. */}
          {errorMsg && (
            <p role="alert" className="mt-3 text-[13px] text-danger break-keep">{errorMsg}</p>
          )}
          {/* §5: 터치 타겟 44px 이상 + 인접 간격 8px 이상 */}
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={startPayment} disabled={isPending} className={BAR_BTN}>
              {isPending ? '결제 진행 중...' : '결제하고 담기'}
            </button>
            <button
              type="button"
              onClick={startClose}
              disabled={isPending}
              className="w-full py-[14px] rounded-lg border border-border text-fg2 text-[15px] font-semibold hover:bg-surface2 transition-colors disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
