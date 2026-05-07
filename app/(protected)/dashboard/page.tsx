import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './LogoutButton';
import { signOutAction } from './actions';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <p>환영합니다, {user?.email}</p>
      <LogoutButton action={signOutAction} />
    </div>
  );
}
