// 0601: **미완 페이지.** 결제 실패·취소 시 토스가 여기로 돌려보낸다
//   (쿼리: ?code=&message=&orderId=).
//   다음 커밋에서 여기에 붙는다 — code·message를 읽어 사용자에게 사유를 보이고,
//   orderId로 찾은 주문을 status=FAILED로 기록한다. 다시 시도할 경로(원본 플랜으로
//   돌아가기)도 그때 함께 둔다.
export default function PaymentFailPage() {
  return (
    <div className="max-w-[var(--reading-w)] mx-auto">
      <h1 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.02em] break-keep">
        결제가 완료되지 않았습니다
      </h1>
      <p className="mt-3 text-sm text-muted">
        결제가 취소되었거나 처리 중 문제가 발생했습니다.
      </p>
    </div>
  );
}
