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
            className={`text-sm transition-colors ${
              isActive
                ? 'text-[#1A1A1A] dark:text-fg font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-muted dark:hover:text-fg'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
