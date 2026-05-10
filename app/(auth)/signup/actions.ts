'use server';
import { redirect } from 'next/navigation';
import { signUp } from '@/lib/auth/actions';

export async function signupAction(_prevState: unknown, formData: FormData) {
  const result = await signUp(
    formData.get('email') as string,
    formData.get('password') as string,
    formData.get('passwordConfirm') as string,
  );
  if (result && 'data' in result) {
    redirect('/login');
  }
  return result;
}
