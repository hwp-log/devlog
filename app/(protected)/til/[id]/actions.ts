'use server';
import { redirect } from 'next/navigation';
import { updateTilEntry, deleteTilEntry } from '@/lib/til/actions';

export async function updateTilEntryAction(formData: FormData) {
  const id = formData.get('id') as string;
  const result = await updateTilEntry(
    id,
    formData.get('title') as string,
    formData.get('content') as string,
  );
  if ('data' in result) {
    redirect('/til');
  }
}

export async function deleteTilEntryAction(formData: FormData) {
  const id = formData.get('id') as string;
  const result = await deleteTilEntry(id);
  if ('data' in result) {
    redirect('/til');
  }
}
