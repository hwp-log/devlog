'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BASE_NAV = [
  { href: '/story', label: 'Story' },
  { href: '/spot-finder', label: 'SpotFinder' },
  { href: '/plan-finder', label: 'PlanFinder' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-6">
      {BASE_NAV.map(({ href, label }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative text-sm transition-colors ${
              isActive
                ? 'text-[#1A1A1A] dark:text-fg'
                : 'text-slate-500 hover:text-slate-800 dark:text-muted dark:hover:text-fg'
            }`}
          >
            {label}
            {isActive && (
              <span
                aria-hidden
                className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 w-1 h-1 rounded-full bg-primary"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
