'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { LocalSpot } from '@/lib/types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

type ActionState = { error: string } | null;

export async function createStoryAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = formData.get('title')?.toString().trim() ?? '';
  const content = formData.get('content')?.toString().trim() ?? '';
  const tagsRaw = formData.get('tags') as string;
  const tagNames: string[] = JSON.parse(tagsRaw || '[]');
  const spotsRaw = formData.get('spots') as string;
  const spotsData: LocalSpot[] = JSON.parse(spotsRaw || '[]');

  if (!title) return { error: '제목을 입력해주세요' };
  if (!content) return { error: '본문을 입력해주세요' };

  // 파일 검증 (트랜잭션 전)
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('spotPhoto_') || !(value instanceof File)) continue;
    if (value.size > MAX_SIZE) return { error: '파일 크기는 5MB 이하여야 합니다' };
    if (!ALLOWED_TYPES.includes(value.type)) return { error: 'jpeg, png, webp만 허용됩니다' };
  }

  // 트랜잭션: Story + Spots 생성, real spotId 획득
  const tmpToReal: Array<{ tmpId: string; realId: string }> = [];

  const story = await prisma.$transaction(async (tx) => {
    const s = await tx.story.create({
      data: {
        title,
        content,
        photoUrl: null,
        userId: user.id,
        tags: {
          connectOrCreate: tagNames.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
    });

    for (const [i, spot] of spotsData.entries()) {
      const created = await tx.spot.create({
        data: {
          storyId: s.id,
          name: spot.name,
          lat: spot.lat,
          lng: spot.lng,
          order: i + 1,
          review: spot.review ?? null,
          address: spot.address ?? null,
          description: spot.description ?? null,
          photoUrl: null,
        },
      });
      tmpToReal.push({ tmpId: spot.id, realId: created.id });
    }

    return s;
  });

  // 트랜잭션 바깥: Storage 업로드 (부분 실패 허용)
  for (const { tmpId, realId } of tmpToReal) {
    const file = formData.get(`spotPhoto_${tmpId}`);
    if (!(file instanceof File)) continue;

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/spot/${realId}/${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('story-photos')
      .upload(path, file, { upsert: true });
    if (uploadError) continue;

    const { data: { publicUrl } } = supabase.storage
      .from('story-photos')
      .getPublicUrl(uploadData.path);

    await prisma.spot.update({ where: { id: realId }, data: { photoUrl: publicUrl } });
  }

  redirect(`/story/${story.id}`);
}
