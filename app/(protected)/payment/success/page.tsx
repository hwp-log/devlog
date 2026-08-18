// 0601: **미완 페이지.** 결제창이 정상적으로 돌아오는지 확인하는 용도로만 존재한다.
//   다음 커밋에서 여기에 붙는다 —
//   ① searchParams의 paymentKey·orderId·amount를 읽고
//   ② orders 행을 orderId로 찾아 amount가 같은지 대조(다르면 승인하지 않는다)
//   ③ 토스 승인 API 호출(TOSS_SECRET_KEY는 서버 전용 모듈에서만)
//   ④ status=PAID·approvedAt·paymentKey 기록
//   ⑤ copyPublicPlanAction(0599)을 호출해 실제 담기 실행
//
//   함께 판단할 것: 이 라우트가 (protected) 안이라 로그인 상태를 전제한다.
//   결제 도중 세션이 만료되거나 다른 기기에서 돌아오면 로그인 화면으로 튕기면서
//   쿼리(paymentKey·orderId·amount)가 사라지고, 그러면 승인할 방법이 없어진다.
//   승인을 붙일 때 이 경우를 어떻게 다룰지(라우트 위치·쿼리 보존·재개 경로) 결정해야 한다.
export default function PaymentSuccessPage() {
  return (
    <div className="max-w-[var(--reading-w)] mx-auto">
      <h1 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.02em] break-keep">
        결제가 완료되었습니다
      </h1>
      <p className="mt-3 text-sm text-muted">
        담기 처리는 곧 이어집니다.
      </p>
    </div>
  );
}
