import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/app/(protected)/dashboard/LogoutButton';
import { signOutAction } from '@/app/(protected)/dashboard/actions';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initial = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold text-slate-800">DevLog</Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">대시보드</Link>
            <Link href="/til" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">TIL</Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-medium">
                {initial}
              </div>
              <span className="text-sm text-slate-600">{user?.email}</span>
            </div>
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
