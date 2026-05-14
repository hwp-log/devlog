import Link from 'next/link';
import { LogoutButton } from '@/app/(protected)/dashboard/LogoutButton';
import { signOutAction } from '@/app/(protected)/dashboard/actions';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold text-slate-800">DevLog</Link>
          <nav className="flex items-center gap-4">
            <Link href="/til" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">TIL</Link>
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">대시보드</Link>
            <LogoutButton action={signOutAction} />
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
