'use client';
import { usePathname } from 'next/navigation';

// A005 §8 화면별 모드 배정표의 유일한 코드 표현 — 다크 화면 추가 시 여기에 1줄.
// 0284: '/spot-finder' 해제 — 테마 토글 편입(멘토 피드백 결정). 전 화면이 루트 토글(0283)을 따름.
const DARK_ROUTES: string[] = [];
// 0485: 모바일에서 헤더를 숨기는 풀블리드 라우트 — 구 HeaderGate.HIDE_HEADER_ON_MOBILE 이관.
// 구 HeaderGate는 조건부 렌더(children ↔ wrapper div)로 헤더 서브트리를 remount시켜, 소프트 내비
// 진입 시 in-flow sticky 헤더(57px)가 삽입·제거되며 main이 57px 바운스했다(0485 계측). 데이터 마커를
// 안정 래퍼(이 div)에 붙이고 globals.css 순수 CSS로 가시성만 토글 → remount 없음 + 하드로드/소프트
// 내비 첫 페인트 동일. 실제 숨김(모바일 한정)은 globals.css [data-hide-header] header.glass-header.
const HIDE_HEADER_ON_MOBILE_ROUTES = ['/spot-finder'];

export function ThemeScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const dark = DARK_ROUTES.some((route) => pathname.startsWith(route));
  const hideHeaderMobile = HIDE_HEADER_ON_MOBILE_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div
      data-theme={dark ? 'dark' : undefined}
      data-hide-header={hideHeaderMobile ? '' : undefined}
      className={`min-h-screen min-h-svh flex flex-col${dark ? ' bg-bg-deep' : ''}`}
      style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
    >
      {children}
    </div>
  );
}
