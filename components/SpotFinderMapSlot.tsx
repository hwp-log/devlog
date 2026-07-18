import { MapPin, MapPinOff } from 'lucide-react';

// 0277: SpotFinder 지도 슬롯 표시 서피스 — 게이트 분리 후 "지도 영역만" 덮는 오버레이.
// 순수 표시(로직 없음). 색은 theme.ts 토큰만(리터럴 금지). 부모(중앙 지도 div, relative)에
// 형제로 놓이며 자체적으로 absolute inset-0. z-20 = 모바일 시트(z-30)·모달(z-60) 아래
// → 리스트·상세는 항상 위에 보인다. 시안: Dotrip Desktop|Mobile Loading.html.

type Variant = 'loading' | 'error' | 'auth';

export function SpotFinderMapSlot({
  variant,
  slow = false,
  onRetry,
}: {
  variant: Variant;
  slow?: boolean;
  onRetry?: () => void;
}) {
  if (variant === 'loading') {
    return (
      <div className="absolute inset-0 z-20 skeleton-shimmer flex flex-col items-center justify-center gap-3 text-center">
        {/* 지도핀 breathe — 셔머와 같은 1.4s 리듬(opacity 0.4~0.85). 색은 primary 토큰 */}
        <MapPin
          className="w-9 h-9 text-primary animate-[map-pin-breathe_1.4s_ease-in-out_infinite]"
          aria-hidden
        />
        <p className="text-sm text-fg2">지도를 불러오는 중</p>
        {slow && <p className="text-xs text-muted">잠시만요, 지도를 준비하고 있어요</p>}
      </div>
    );
  }

  // error / auth — 셔머 아님, 불투명 카드 배경에 중앙 안내
  const isAuth = variant === 'auth';
  return (
    <div className="absolute inset-0 z-20 bg-card flex flex-col items-center justify-center gap-3 p-6 text-center">
      <MapPinOff className="w-9 h-9 text-muted" aria-hidden />
      <p className="text-sm text-fg2 break-keep leading-relaxed">
        {isAuth ? (
          <>
            지도 설정을 확인해주세요.
            <br />
            (ncpKeyId·도메인 등록)
          </>
        ) : (
          '지도를 불러오지 못했습니다.'
        )}
      </p>
      {/* 재시도 버튼은 네트워크 실패(error)에만 — 인증 실패는 재시도해도 동일(설정 문제) */}
      {!isAuth && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
