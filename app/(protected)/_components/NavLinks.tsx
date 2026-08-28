'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const BASE_NAV = [
  { href: '/story', label: 'Story' },
  { href: '/spot-finder', label: 'SpotFinder' },
  { href: '/plan-finder', label: 'PlanFinder' },
];

// 0485: 구 HeaderGate wrapper 토글이 이 서브트리를 remount시켰으나, 헤더 숨김이 CSS 스코프(ThemeScope
// data-hide-header)로 이관되며 헤더는 상시 마운트 = remount 없음. lastCenter(모듈 보존)는 그 remount 시
// 새 인스턴스가 이전 위치에서 미끄러지게 하던 장치라, 현재는 최초 마운트에서만 읽혀 사실상 미사용(무해).
// 활성 점 애니메이션 로직 자체는 불변 — 잔존 로직의 별도 정리는 후속 과제.
let lastCenter: number | null = null;

export function NavLinks() {
  const pathname = usePathname();
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeIndex = BASE_NAV.findIndex(({ href }) => pathname.startsWith(href));

  const startedAt = useRef(lastCenter); // 이 인스턴스 마운트 시점의 이전 위치(null=최초 로드)
  const [center, setCenter] = useState<number | null>(lastCenter);
  // 최초 로드에서만 transition off(0→활성위치 점프 방지). remount면 이전 위치 있으니 처음부터 on.
  const [enabled, setEnabled] = useState(lastCenter != null);

  const getCenter = useCallback(() => {
    const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    if (!el || el.offsetWidth === 0) return null;
    return el.offsetLeft + el.offsetWidth / 2;
  }, [activeIndex]);

  // 페인트 후 측정→이동. remount 시 이전 위치(초기 render)가 먼저 페인트된 뒤 target으로 슬라이드.
  useEffect(() => {
    const target = getCenter();
    if (target == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- React Compiler 대비 규칙. 현재 동작 정상이며, 해소하려면 구조 변경이 필요해 별건으로 남김 (페인트 후 DOM 측정→배치 패턴이라 effect 내 setState가 불가피)
      setCenter(null); // 비활성 라우트/모바일(display:none) → 감춤
      return;
    }
    lastCenter = target;
    if (!enabled && startedAt.current == null) {
      // 최초 마운트: 슬라이드 없이 즉시 배치 → 다음 프레임에 transition 활성
      startedAt.current = target;
      setCenter(target);
      const id = requestAnimationFrame(() => setEnabled(true));
      return () => cancelAnimationFrame(id);
    }
    setCenter(target); // remount/네비: 이전 위치에서 target으로 슬라이드
  }, [pathname, getCenter, enabled]);

  // 레이아웃 변동(리사이즈·폰트 스왑) 재측정
  useEffect(() => {
    const remeasure = () => {
      const c = getCenter();
      if (c != null) {
        lastCenter = c;
        setCenter(c);
      }
    };
    window.addEventListener('resize', remeasure);
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) remeasure();
    });
    return () => {
      cancelled = true;
      window.removeEventListener('resize', remeasure);
    };
  }, [getCenter]);

  return (
    <nav className="relative hidden lg:flex items-center gap-6">
      {BASE_NAV.map(({ href, label }, i) => {
        const isActive = i === activeIndex;
        return (
          <Link
            key={href}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            href={href}
            className={`text-sm transition-colors ${
              isActive
                ? 'text-[#1A1A1A] dark:text-fg'
                : 'text-slate-500 hover:text-slate-800 dark:text-muted dark:hover:text-fg'
            }`}
          >
            {label}
          </Link>
        );
      })}
      {/* 단일 점(6px): 활성 메뉴 중심으로 translateX. 인라인 transition으로 계산 스타일 확실 반영(레이어·variant 무관).
          reduced-motion 시 !important로 인라인 transition 제거 → 즉시 이동. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-2.5 left-0 w-1.5 h-1.5 rounded-full bg-primary motion-reduce:transition-none!"
        style={{
          transform: `translateX(calc(${center ?? 0}px - 50%))`,
          opacity: center != null ? 1 : 0,
          transition: enabled ? 'transform 250ms ease-out' : 'none',
        }}
      />
    </nav>
  );
}
