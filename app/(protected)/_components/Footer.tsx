'use client';
import { usePathname } from 'next/navigation';
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
        <DataAttribution variant="footer" />
        {/* 전자상거래법 제10조 사업자 신원정보. 이메일은 포워딩 설정 완료된 실주소(mailto 미연결).
            주소·전화·통신판매업 신고번호는 미확정 별건, 약관·개인정보처리방침 링크는 0615 별건.
            항목별 span + flex-wrap — 좁은 폭에서 항목 단위로만 줄바꿈. 구분자는 낭독 제외 */}
        <p className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-xs text-muted break-keep">
          <span>상호: 이음</span>
          <span aria-hidden>|</span>
          <span>대표자: 박현우</span>
          <span aria-hidden>|</span>
          <span>사업자등록번호: 787-56-01175</span>
          <span aria-hidden>|</span>
          <span>개인정보 보호책임자: 박현우</span>
          <span aria-hidden>|</span>
          <span>이메일: hello@dotrip.io</span>
          <span aria-hidden>|</span>
          <span>호스팅 서비스 제공업체: Vercel Inc.</span>
        </p>
        <p className="text-xs text-muted">© 2026 Dotrip. All rights reserved.</p>
      </div>
    </footer>
  );
}
