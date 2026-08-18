import Link from 'next/link';

// 0602: 결제 실패·취소 안내. 주문 상태 정리는 /payment/failed(route.ts)에서 끝나고
//   이 화면은 사유만 보여준다(승인 쪽과 같은 분리).
type Props = { searchParams: Promise<{ code?: string; message?: string; planId?: string }> };

export default async function PaymentFailPage({ searchParams }: Props) {
  const { code, message, planId } = await searchParams;

  // 사용자가 결제창을 닫은 건 오류가 아니라 선택이다 — 같은 화면을 오류 톤으로 보이지 않게
  //   제목만 갈라 쓴다(토스 코드: PAY_PROCESS_CANCELED).
  const canceled = code === 'PAY_PROCESS_CANCELED';

  return (
    <div className="max-w-[var(--reading-w)] mx-auto">
      <h1 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.02em] break-keep">
        {canceled ? '결제를 취소했습니다' : '결제가 완료되지 않았습니다'}
      </h1>
      <p className="mt-3 text-sm text-fg2 break-keep">
        {message ?? '결제 처리 중 문제가 발생했습니다.'}
      </p>
      {code && !canceled && (
        <p className="mt-1 text-xs text-muted">오류 코드: {code}</p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-2">
        <Link
          href={planId ? `/plan-finder/${planId}` : '/plan-finder'}
          className="px-4 py-[10px] rounded-lg bg-primary text-white text-sm font-bold"
        >
          {planId ? '원본 플랜으로 돌아가기' : '플랜 둘러보기'}
        </Link>
      </div>
    </div>
  );
}
