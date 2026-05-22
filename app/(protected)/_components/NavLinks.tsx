'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/story', label: 'Story' },
  { href: '/spot-finder', label: 'SpotFinder' },
  { href: '/cost-plan', label: 'CostPlan' },
  { href: '/my-dots', label: 'My Dots' },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-6">
      {NAV_LINKS.map(({ href, label }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm transition-colors ${
              isActive
                ? 'text-[#1A1A1A] font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
