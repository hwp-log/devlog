import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center flex flex-col items-center gap-6">
        <h1 className="text-4xl font-bold text-slate-800">DevLog</h1>
        <p className="text-slate-500 max-w-xs">개발 학습을 기록하고 성장을 추적하세요</p>
        <div className="flex gap-3">
          <Link href="/login" className="px-5 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700 transition-colors">
            로그인
          </Link>
          <Link href="/signup" className="px-5 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-100 transition-colors">
            회원가입
          </Link>
        </div>
      </div>
    </main>
  );
}
