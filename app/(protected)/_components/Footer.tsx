'use client';
import { usePathname } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Logo } from './Logo';

// 풀블리드 지도 화면엔 푸터 숨김(지도와 충돌) — ProtectedMain FULL_BLEED_ROUTES와 동일 개념
const HIDE_FOOTER_ROUTES = ['/spot-finder'];

export function Footer() {
  const pathname = usePathname();
  if (HIDE_FOOTER_ROUTES.some((route) => pathname.startsWith(route))) return null;

  return (
    <footer className="bg-popover dark:bg-bg-deep text-center">
      {/* 전폭 밴드 + 중앙 정렬 콘텐츠(max-w). 모바일은 floating BottomTabBar 아래로 안 가리게 하단 여백 확보 */}
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10 flex flex-col items-center gap-3">
        <Logo />
        <div className="flex items-center justify-center gap-1.5 text-sm text-fg2">
          <Mail size={14} className="shrink-0" />
          {/* 도메인 미확정 — mailto 미연결, 텍스트만 */}
          <span>hello@dotrip</span>
        </div>
        <p className="max-w-md text-xs text-muted leading-relaxed break-keep">
          이 서비스의 촬영지 정보 및 일부 사진·위치 데이터는 한국문화정보원에서 제공받았습니다.
        </p>
        <p className="text-xs text-muted">© 2026 Dotrip. All rights reserved.</p>
      </div>
    </footer>
  );
}
