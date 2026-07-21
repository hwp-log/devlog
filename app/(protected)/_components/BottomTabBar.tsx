'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { BookOpen, Map, Compass, PenSquare } from 'lucide-react';

const TABS = [
  { href: '/story', label: 'Story', Icon: BookOpen },
  { href: '/spot-finder', label: 'SpotFinder', Icon: Map },
  { href: '/plan-finder', label: 'PlanFinder', Icon: Compass },
  { href: '/story/new', label: 'Write', Icon: PenSquare },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // 1단계(줌만): 핀치 줌(scale>1) 시 fixed 바가 layout viewport 기준이라 화면 밖(주소창 뒤)으로 밀림.
  // Visual Viewport API로 visual viewport 하단에 재고정(MDN viewportHandler). scale≤1(키보드·주소창)엔 미개입(2단계).
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return; // 미지원(구형·데스크톱) → className [transform:translateZ(0)] + 기존 fixed 폴백
    const update = () => {
      if (vv.scale > 1) {
        // layout 하단 → visual 하단으로 이동 + 줌 상쇄. 좌·하단 기준 축소(바닥 고정).
        const x = vv.offsetLeft;
        const y = vv.offsetTop + vv.height - window.innerHeight;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${1 / vv.scale})`;
        el.style.transformOrigin = '0 100%';
      } else {
        el.style.transform = ''; // 원복 → className translateZ(0) 폴백 노출
        el.style.transformOrigin = '';
      }
    };
    // 최종 상태 수렴 안전망: iOS가 줌 종료 마지막 프레임 이벤트를 놓쳐도 탭바가 정상 위치로 수렴하게.
    //  A) 이벤트 직후 다음 프레임 재확인(rAF)  B) 이벤트 멈춘 뒤 150ms 재적용(디바운스). 상시 폴링 아님.
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onEvent = () => {
      update();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
      clearTimeout(timer);
      timer = setTimeout(update, 150);
    };
    update();
    vv.addEventListener('resize', onEvent);
    vv.addEventListener('scroll', onEvent);
    return () => {
      vv.removeEventListener('resize', onEvent);
      vv.removeEventListener('scroll', onEvent);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  function isActive(href: string) {
    if (href === '/story/new') return pathname === '/story/new';
    if (href === '/story') return pathname.startsWith('/story') && pathname !== '/story/new';
    return pathname.startsWith(href);
  }

  // [transform:translateZ(0)]: 폴백/미지원 시 fixed 바 GPU 레이어 승격(리플로우 이탈 완화). 줌 시엔 위 useEffect의 인라인 transform이 덮음.
  return (
    <div
      ref={ref}
      className="fixed left-[14px] right-[14px] bottom-[calc(14px+env(safe-area-inset-bottom))] z-40 lg:hidden overflow-hidden rounded-[22px] border border-slate-200/50 dark:border-white/40 bg-card/90 backdrop-blur-sm shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] [transform:translateZ(0)]"
    >
      <nav aria-label="주요 메뉴" className="flex items-stretch h-14">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? 'text-[#1A1A1A] dark:text-fg font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-muted dark:hover:text-fg'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[10px] leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
