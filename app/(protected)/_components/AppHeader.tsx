import Link from 'next/link';
import { Logo } from './Logo';
import { NavLinks } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';
import { UserDropdown } from './UserDropdown';

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
    // 0485: 헤더는 항상 마운트. 모바일 풀블리드(/spot-finder) 숨김은 구 HeaderGate 조건부 렌더 대신
    // ThemeScope 루트의 data-hide-header 마커 + globals.css 순수 CSS로 처리(remount·main 57px 바운스 제거).
    // z-50 = 전역 크롬 최상위 단계(globals.css 상단 z 계층표 참조). 페이지 콘텐츠·인페이지 팝오버(≤50) 위,
    // 풀스크린 지도 테이크오버(SpotMap z-55 / SpotFinderMap z-60) 아래 — 스토리 지도 풀스크린은 헤더를 덮어야 하므로 55 미만 유지.
    <header className="sticky top-0 z-50 glass-header">
        <div className={`${widthClassName ?? ''} px-6 h-14 grid grid-cols-[1fr_auto_1fr] items-center`}>
          <div className="justify-self-start">
            <Logo />
          </div>
          <NavLinks />
          {/* col-start-3 명시 — 모바일에서 NavLinks(display:none) 소멸 시 중앙 열로 자동 배치되는 것 방지 */}
          <div className="col-start-3 justify-self-end flex items-center gap-3">
            {/* 테마 스위치(0293→0482) — 게스트 전용 헤더 잔류. 로그인 시엔 프로필 드롭다운
                설정 구역으로 이전(멘토 피드백: 설정류는 프로필/테마 레이어로). 게스트는
                드롭다운이 없고 2단 토글이라 OS 추종도 없어, 헤더에서 빼면 라이트에 갇힘 */}
            {!isLoggedIn && <ThemeToggle />}
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
  );
}
