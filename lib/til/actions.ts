import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createTilEntry(title: string, content: string) {
  if (title.trim() === '') {
    return { error: '제목을 입력해주세요' };
  }
  if (content.trim() === '') {
    return { error: '내용을 입력해주세요' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { data, error } = await supabase
    .from('til_entries')
    .insert({ user_id: user.id, title, content })
    .select()
    .single();

  if (error) {
    return { error: 'TIL 저장에 실패했습니다' };
  }

  return { data: { entry: data } };
}

export async function getTilEntries() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { data, error } = await supabase
    .from('til_entries')
    .select()
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { error: 'TIL 조회에 실패했습니다' };
  }

  return { data: { entries: data } };
}

export async function getTilEntry(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { data, error } = await supabase
    .from('til_entries')
    .select()
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return { error: '찾을 수 없습니다.' };
  }

  return { data: { entry: data } };
}

export async function updateTilEntry(id: string, title: string, content: string) {
  if (title.trim() === '') {
    return { error: '제목을 입력해주세요' };
  }
  if (content.trim() === '') {
    return { error: '내용을 입력해주세요' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { data, error } = await supabase
    .from('til_entries')
    .update({ title, content })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return { error: 'TIL 수정에 실패했습니다' };
  }

  revalidatePath('/til');
  revalidatePath(`/til/${id}`);
  return { data: { entry: data } };
}

export async function deleteTilEntry(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { error } = await supabase
    .from('til_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return { error: 'TIL 삭제에 실패했습니다' };
  }

  revalidatePath('/til');
  return { data: null };
}

export async function getTilStreak() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { data, error } = await supabase.rpc('get_til_streak');

  if (error) {
    return { error: '통계를 불러오지 못했습니다' };
  }

  const row = data?.[0] ?? { current_streak: 0, best_streak: 0 };
  return {
    data: {
      currentStreak: Number(row.current_streak),
      bestStreak: Number(row.best_streak),
    },
  };
}
