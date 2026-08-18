import Link from 'next/link';

// 0602: 결과 표시 전용 페이지. 검증·승인·담기는 전부 /payment/confirm(route.ts)에서
//   끝나고 이 화면은 결과만 그린다 — 부수효과를 렌더에 두지 않기 위한 분리다.
//   (0601에서 우려했던 "세션 만료로 튕기며 쿼리 유실"은 해당하지 않는다:
//    (protected) 레이아웃은 미인증 사용자를 튕기지 않고, Route Handler는 레이아웃을
//    거치지도 않는다. 세션 없는 진입은 confirm 핸들러가 직접 판정한다.)
type Props = { searchParams: Promise<{ planId?: string }> };

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const { planId } = await searchParams;

  return (
    <div className="max-w-[var(--reading-w)] mx-auto">
      <h1 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.02em] break-keep">
        결제가 완료되었습니다
      </h1>
      <p className="mt-3 text-sm text-fg2 break-keep">
        플랜을 내 여행으로 담았습니다. 날짜와 비용은 자유롭게 수정할 수 있어요.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {/* planId가 없는 경우 = 이미 승인된 주문으로 재진입한 경우(confirm 핸들러 ④).
            사본 id를 orders에 저장하지 않으므로 그때는 목록으로 보낸다. */}
        {planId ? (
          <Link
            href={`/plan-finder/${planId}`}
            className="px-4 py-[10px] rounded-lg bg-primary text-white text-sm font-bold"
          >
            담은 플랜 보기
          </Link>
        ) : null}
        <Link
          href="/my-plan"
          className="px-4 py-[10px] rounded-lg border border-border text-fg2 text-sm hover:bg-surface2 transition-colors"
        >
          내 플랜 목록
        </Link>
      </div>
    </div>
  );
}
