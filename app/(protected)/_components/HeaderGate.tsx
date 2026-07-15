'use client';
import { usePathname } from 'next/navigation';

// 0226: SpotFinder는 모바일에서 앱 헤더 숨김(데스크탑 lg는 유지 — 3열 헤더 불변). 다른 탭(Story·Plan)은 항상 표시.
// RSC 서버→클라 경계를 넘어온 children을 cloneElement/props로 조작하면 fragile(children.props undefined 크래시) →
// composition(wrapper)으로 전환. 일반 block wrapper는 sticky를 깨므로 display:contents(무박스)로 sticky 보존.
const HIDE_HEADER_ON_MOBILE = ['/spot-finder'];

export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideOnMobile = HIDE_HEADER_ON_MOBILE.some((r) => pathname.startsWith(r));
  if (!hideOnMobile) return children;
  // 모바일 hidden(display:none)=헤더 숨김 / lg:contents(display:contents)=데스크탑 표시 + wrapper 무박스로 sticky 유지.
  return <div className="hidden lg:contents">{children}</div>;
}
