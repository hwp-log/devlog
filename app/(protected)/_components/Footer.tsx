'use client';
import { usePathname } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Logo } from './Logo';
import { DataAttribution } from '@/components/DataAttribution';

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
          {/* 포워딩 설정 완료된 실주소. mailto 미연결(텍스트만) */}
          <span>hello@dotrip.io</span>
        </div>
        <DataAttribution variant="footer" />
        <p className="text-xs text-muted">© 2026 Dotrip. All rights reserved.</p>
      </div>
    </footer>
  );
}
