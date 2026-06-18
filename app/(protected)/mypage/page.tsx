import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { NicknameForm } from './NicknameForm';
import { PasswordForm } from './PasswordForm';

export default async function MyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, nickname: true },
  });
  if (!profile) redirect('/login');

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">마이페이지</h1>
      <NicknameForm email={profile.email} nickname={profile.nickname} />
      <PasswordForm />
    </div>
  );
}
