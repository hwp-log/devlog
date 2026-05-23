import { createClient } from '@/lib/supabase/client';

export async function uploadStoryImage(file: File, userId: string): Promise<string> {
  const supabase = createClient();

  const ext = file.name.split('.').pop();
  const uuid = crypto.randomUUID();
  const path = `${userId}/${uuid}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('story-photos')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);

  const { data } = supabase.storage.from('story-photos').getPublicUrl(path);

  return data.publicUrl;
}
