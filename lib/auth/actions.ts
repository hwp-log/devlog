'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail } from './validators';
import { prisma } from '@/lib/prisma';

/**
 * 이메일/비밀번호로 로그인 처리
 * 이메일 형식 검증 후 Supabase Auth 호출
 */
export async function signIn(email: string, password: string) {
  if (!isValidEmail(email)) {
    return { error: '이메일 형식이 올바르지 않습니다' };
  }
  if (password === '') {
    return { error: '비밀번호를 입력해주세요' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다' };
  }

  return { data: { user: data.user } };
}

export async function signUp(email: string, password: string, passwordConfirm: string) {
  if (!isValidEmail(email)) {
    return { error: '이메일 형식이 올바르지 않습니다' };
  }
  if (password.length < 8) {
    return { error: '비밀번호는 8자 이상이어야 합니다' };
  }
  if (password !== passwordConfirm) {
    return { error: '비밀번호가 일치하지 않습니다' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: '회원가입에 실패했습니다' };
  }

  if (data.user) {
    try {
      await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email!,
        },
      });
    } catch (e) {
      console.error('public.users 생성 실패:', e);
    }
  }

  return { data: { user: data.user } };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
