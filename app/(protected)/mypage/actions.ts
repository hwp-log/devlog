'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function updateNicknameAction(
  nickname: string,
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const trimmed = nickname.trim();
  if (trimmed.length === 0) return { error: '닉네임을 입력해주세요' };
  if (trimmed.length > 20) return { error: '닉네임은 20자 이하여야 합니다' };

  await prisma.user.update({
    where: { id: user.id },
    data: { nickname: trimmed },
  });

  revalidatePath('/mypage');
  return null;
}
