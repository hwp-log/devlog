'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function updatePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<{ error: string } | null> {
  if (!currentPassword || !newPassword) return { error: '모든 항목을 입력해주세요' };
  if (newPassword.length < 8) return { error: '비밀번호는 8자 이상이어야 합니다' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password: newPassword,
  });

  if (error) {
    if (error.status === 422 || error.message.toLowerCase().includes('credential')) {
      return { error: '현재 비밀번호가 올바르지 않습니다' };
    }
    return { error: '비밀번호 변경에 실패했습니다' };
  }

  return null;
}

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

function extractAvatarPath(url: string, userId: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const prefix = `${supabaseUrl}/storage/v1/object/public/avatars/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  if (!path.startsWith(`${userId}/`)) return null;
  return path;
}

export async function updateAvatarAction(
  newUrl: string,
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  if (!extractAvatarPath(newUrl, user.id)) {
    return { error: '잘못된 아바타 URL입니다' };
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: newUrl },
  });

  if (current?.avatarUrl) {
    const oldPath = extractAvatarPath(current.avatarUrl, user.id);
    if (oldPath) {
      await supabase.storage.from('avatars').remove([oldPath]);
    }
  }

  revalidatePath('/mypage');
  return null;
}

export async function removeAvatarAction(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  if (!current?.avatarUrl) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: null },
  });

  const oldPath = extractAvatarPath(current.avatarUrl, user.id);
  if (oldPath) {
    await supabase.storage.from('avatars').remove([oldPath]);
  }

  revalidatePath('/mypage');
  return null;
}
