import { MapPin, MapPinOff } from 'lucide-react';

// 0277: SpotFinder 지도 슬롯 표시 서피스 — 게이트 분리 후 "지도 영역만" 덮는 오버레이.
// 순수 표시(로직 없음). 색은 theme.ts 토큰만(리터럴 금지). 부모(중앙 지도 div, relative)에
// 형제로 놓이며 자체적으로 absolute inset-0. z-20 = 모바일 시트(z-30)·모달(z-60) 아래
// → 리스트·상세는 항상 위에 보인다. 시안: Dotrip Desktop|Mobile Loading.html.

type Variant = 'loading' | 'error' | 'auth';

// 0280: 모바일 안내 위치 = 시트 스냅별 가시 영역의 수학적 중앙(시트 추종 2안).
// B안(pt-[20svh] 고정)은 시트를 peek로 내려도 안내가 제자리라 어색 — 실기기 기각.
// 추종이 업계 표준(Turo: 시트 이동 시 콘텐츠 중심 재조정 + 부드러운 동조).
// SHEET_MAX_H(SpotFinderMapNaver)와 페어 — 한쪽만 바꾸면 어긋남:
//   half 가시 영역 = 100svh − max(58svh, 359px+env) → top = 그 절반 (≈21svh@844px)
//   peek 가시 영역 = 100svh − (150px+env)           → top = 그 절반 (≈41svh@844px)
// top은 길이 calc라 CSS 보간 가능 → transition-[top]. 시간·커브는 시트(:1019)와 동일
// 리터럴(320ms / cubic-bezier(0.32,0.72,0,1)) — 시트와 같은 타이밍으로 스르륵 동조.
// 드래그 실시간 추적 없음 — 2단 스냅 값만 주고 중간은 transition이 보간.
// -translate-y-1/2 = 콘텐츠 높이(loading ~84px vs error ~144px) 무관 정중앙 —
// 소형 폰(359px 하한 지배, SE급)에서도 error 스택이 가시 영역 안에 안착.
const SLOT_TOP = {
  half: 'top-[calc((100svh-max(58svh,359px+env(safe-area-inset-bottom)))/2)]',
  peek: 'top-[calc((100svh-150px-env(safe-area-inset-bottom))/2)]',
} as const;

// 모바일 = absolute + top 추종 / 데탑 = 정적으로 복귀해 outer flex 센터링에 위임(무transition)
function slotInnerClass(sheetLevel: 'peek' | 'half'): string {
  return `absolute inset-x-0 ${SLOT_TOP[sheetLevel]} -translate-y-1/2 transition-[top] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col items-center gap-3 lg:static lg:translate-y-0 lg:transition-none`;
}

export function SpotFinderMapSlot({
  variant,
  sheetLevel,
  slow = false,
  onRetry,
}: {
  variant: Variant;
  sheetLevel: 'peek' | 'half';
  slow?: boolean;
  onRetry?: () => void;
}) {
  if (variant === 'loading') {
    return (
      <div className="absolute inset-0 z-20 skeleton-shimmer lg:flex lg:items-center lg:justify-center text-center">
        <div className={slotInnerClass(sheetLevel)}>
          {/* 지도핀 breathe — 셔머와 같은 1.4s 리듬(opacity 0.4~0.85). 색은 primary 토큰 */}
          <MapPin
            className="w-9 h-9 text-primary animate-[map-pin-breathe_1.4s_ease-in-out_infinite]"
            aria-hidden
          />
          <p className="text-sm text-fg2">지도를 불러오는 중</p>
          {slow && <p className="text-xs text-muted">잠시만요, 지도를 준비하고 있어요</p>}
        </div>
      </div>
    );
  }

  // error / auth — 셔머 아님, 불투명 카드 배경. 데탑 여백은 outer lg:p-6(구 p-6 등가), 모바일 텍스트 여백은 inner px-6
  const isAuth = variant === 'auth';
  return (
    <div className="absolute inset-0 z-20 bg-card lg:flex lg:items-center lg:justify-center lg:p-6 text-center">
      <div className={`${slotInnerClass(sheetLevel)} px-6`}>
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
    </div>
  );
}
