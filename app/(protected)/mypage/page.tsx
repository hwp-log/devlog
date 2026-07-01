import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { AvatarForm } from './AvatarForm';
import { NicknameForm } from './NicknameForm';
import { PasswordForm } from './PasswordForm';

export default async function MyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, nickname: true, avatarUrl: true },
  });
  if (!profile) redirect('/login');

  return (
    <div className="max-w-md space-y-6">
      <div>
        <p
          className="text-xs font-semibold text-sky-500 mb-1 appear-up"
          style={{ animationDelay: '0s' }}
        >
          MyPage
        </p>
        <h1
          className="text-2xl md:text-3xl font-bold text-[#1A1A1A] appear-up"
          style={{ animationDelay: '0.12s' }}
        >
          마이페이지
        </h1>
      </div>
      <AvatarForm userId={user.id} nickname={profile.nickname} currentAvatarUrl={profile.avatarUrl} />
      <NicknameForm email={profile.email} nickname={profile.nickname} />
      <PasswordForm />
    </div>
  );
}
