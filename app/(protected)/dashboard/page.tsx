import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './LogoutButton';
import { signOutAction } from './actions';
import StreakWidget from './StreakWidget';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-700">환영합니다, {user?.email}</p>
        <LogoutButton action={signOutAction} />
      </div>
      <StreakWidget />
    </div>
  );
}
