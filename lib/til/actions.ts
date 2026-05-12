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
