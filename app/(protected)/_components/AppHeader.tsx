import Link from 'next/link';
import { Logo } from './Logo';
import { NavLinks } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';
import { UserDropdown } from './UserDropdown';
import { HeaderGate } from './HeaderGate';

interface AppHeaderProps {
  isLoggedIn: boolean;
  email: string;
  avatarUrl: string | null;
  nickname: string;
  isAdmin: boolean;
  // Story='max-w-7xl mx-auto' / SpotFinder=undefined(풀블리드) — 각 화면 현행 폭 보존(max-w는 3단계까지 불변)
  widthClassName?: string;
}

export function AppHeader({ isLoggedIn, email, avatarUrl, nickname, isAdmin, widthClassName }: AppHeaderProps) {
  return (
    <HeaderGate>
      <header className="sticky top-0 z-10 glass-header">
        <div className={`${widthClassName ?? ''} px-6 h-14 grid grid-cols-[1fr_auto_1fr] items-center`}>
          <div className="justify-self-start">
            <Logo />
          </div>
          <NavLinks />
          {/* col-start-3 명시 — 모바일에서 NavLinks(display:none) 소멸 시 중앙 열로 자동 배치되는 것 방지 */}
          <div className="col-start-3 justify-self-end flex items-center gap-3">
            {/* 0293: 테마 트랙 스위치 — Write 왼쪽(업계 표준 헤더 위치). 게스트도 유효 */}
            <ThemeToggle />
            {/* Write는 로그인 시에만 — /story/new가 proxy로 비로그인 시 /login 리다이렉트라 게스트 노출 시 "동작 안 하는 버튼" */}
            {isLoggedIn && (
              <Link
                href="/story/new"
                className="hidden lg:inline-flex items-center rounded-full bg-primary px-[17px] py-[7px] text-[12.5px] font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                Write
              </Link>
            )}
            {isLoggedIn ? (
              <UserDropdown email={email} avatarUrl={avatarUrl} nickname={nickname} isAdmin={isAdmin} />
            ) : (
              <Link href="/login" className="text-sm text-fg2 hover:text-fg transition-colors">
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>
    </HeaderGate>
  );
}
