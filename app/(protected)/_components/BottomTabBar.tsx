'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Map, Compass, PenSquare } from 'lucide-react';

const TABS = [
  { href: '/story', label: 'Story', Icon: BookOpen },
  { href: '/spot-finder', label: 'SpotFinder', Icon: Map },
  { href: '/plan-finder', label: 'PlanFinder', Icon: Compass },
  { href: '/story/new', label: 'Write', Icon: PenSquare },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/story/new') return pathname === '/story/new';
    if (href === '/story') return pathname.startsWith('/story') && pathname !== '/story/new';
    return pathname.startsWith(href);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden glass-header border-t border-slate-200/50 dark:border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
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
