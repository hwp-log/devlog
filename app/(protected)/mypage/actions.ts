'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

function buildAnonymizedFields(userId: string) {
  const suffix = userId.slice(0, 4).toUpperCase();
  return {
    email: `deleted_${userId}@deleted.local`,
    nickname: `잊혀진 여행자_${suffix}`,
  };
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

export async function deleteAccountAction(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });
  const anon = buildAnonymizedFields(user.id);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: anon.email,
          nickname: anon.nickname,
          avatarUrl: null,
        },
      });

      // 이 사용자 콘텐츠에서 파생된 복제본의 sourceNickname 익명화.
      // sourceStoryId/sourcePlanId는 @relation 없는 plain String이라 id 리스트로 매칭.
      const storyIds = await tx.story.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const myPlanIds = await tx.myPlan.findMany({
        where: { ownerId: user.id },
        select: { id: true },
      });

      if (storyIds.length > 0) {
        await tx.myPlan.updateMany({
          where: { sourceStoryId: { in: storyIds.map((s) => s.id) } },
          data: { sourceNickname: anon.nickname },
        });
      }
      if (myPlanIds.length > 0) {
        await tx.myPlan.updateMany({
          where: { sourcePlanId: { in: myPlanIds.map((p) => p.id) } },
          data: { sourceNickname: anon.nickname },
        });
      }
    });
  } catch (e) {
    console.error('탈퇴 익명화 실패:', e);
    return { error: '탈퇴 처리 중 오류가 발생했습니다' };
  }

  if (current?.avatarUrl) {
    const oldPath = extractAvatarPath(current.avatarUrl, user.id);
    if (oldPath) {
      await supabase.storage.from('avatars').remove([oldPath]).catch(() => {});
    }
  }

  try {
    const admin = createAdminClient();
    const { error: adminErr } = await admin.auth.admin.deleteUser(user.id);
    if (adminErr) {
      console.error('auth 계정 삭제 실패:', adminErr);
      return { error: '인증 계정 삭제 실패 (관리자에게 문의)' };
    }
  } catch (e) {
    console.error('admin 클라이언트 오류:', e);
    return { error: '탈퇴 처리 실패 (관리자에게 문의)' };
  }

  await supabase.auth.signOut();
  redirect('/');
}
