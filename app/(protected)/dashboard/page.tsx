import { createClient } from '@/lib/supabase/server';
import StreakWidget from './StreakWidget';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-4">
      <p className="text-slate-700">환영합니다, {user?.email}</p>
      <StreakWidget />
    </div>
  );
}
