'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BASE_NAV = [
  { href: '/story', label: 'Story' },
  { href: '/spot-finder', label: 'SpotFinder' },
  { href: '/plan-finder', label: 'PlanFinder' },
];

type NavLinksProps = { isAdmin?: boolean };

export function NavLinks({ isAdmin = false }: NavLinksProps) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...BASE_NAV, { href: '/admin', label: 'Admin' }]
    : BASE_NAV;

  return (
    <nav className="flex items-center gap-6">
      {links.map(({ href, label }) => {
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
