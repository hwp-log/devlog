'use server';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth/actions';

// 이메일, 패스워드 처리 및 Supabase 응답회신
export async function loginAction(_prevState: unknown, formData: FormData) {
  const result = await signIn(
    formData.get('email') as string,
    formData.get('password') as string,
  );
  if (result && 'data' in result) {
    redirect('/dashboard');
  }
  return result;
}
