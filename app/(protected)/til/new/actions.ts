'use server';
import { redirect } from 'next/navigation';
import { createTilEntry } from '@/lib/til/actions';

export async function createTilEntryAction(_prevState: unknown, formData: FormData) {
  const result = await createTilEntry(
    formData.get('title') as string,
    formData.get('content') as string,
  );
  if (result && 'data' in result) {
    redirect('/til');
  }
  return result;
}
