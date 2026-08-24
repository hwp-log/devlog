'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail } from './validators';
import { generateNickname } from './nickname';
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
    // 0612: 원인(중복·rate limit·장애) 미확정 문구 — "이미 가입된 이메일" 명시는 계정 존재
    // 노출(로그인 쪽 뭉뚱그림과 동일 기준). "지금"이 일시적 실패까지 암시(0613에서
    // "잠시 후 재시도" 절은 길이 문제로 축약). SignupForm이 이 문자열 일치로 /login
    // 링크를 붙인다 — 문구 바꾸면 SignupForm의 SIGNUP_BLOCKED_ERROR도 함께 (상호 참조).
    return { error: '이 이메일로는 지금 가입할 수 없습니다. 이미 가입하셨다면 로그인해주세요.' };
  }

  if (data.user) {
    try {
      await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email!,
          nickname: generateNickname(data.user.id),
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
