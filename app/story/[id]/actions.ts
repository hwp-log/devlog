'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { LocalSpot } from '@/lib/types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

type ActionState = { error: string } | null;

export async function updateStoryAction(storyId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) return { error: '수정 권한이 없습니다' };

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

  // 트랜잭션: Story 업데이트 + Spots 동기화, 신규 spot real ID 획득
  const tmpToReal: Array<{ tmpId: string; realId: string }> = [];

  await prisma.$transaction(async (tx) => {
    await tx.story.update({
      where: { id: storyId },
      data: {
        title,
        content,
        tags: {
          set: [],
          connectOrCreate: tagNames.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
    });

    // 제출된 목록에서 실제 DB ID(tmp_ 아닌 것)만 추출
    const realIds = spotsData
      .filter((s) => !s.id.startsWith('tmp_'))
      .map((s) => s.id);

    // 제출 목록에 없는 기존 spot 삭제
    await tx.spot.deleteMany({ where: { storyId, id: { notIn: realIds } } });

    // 기존 spot order/name/review/photoUrl 업데이트
    for (const [i, spot] of spotsData.entries()) {
      if (!spot.id.startsWith('tmp_')) {
        await tx.spot.update({
          where: { id: spot.id },
          data: {
            order: i + 1,
            name: spot.name,
            review: spot.review ?? null,
            photoUrl: spot.photoUrl ?? null,
          },
        });
      }
    }

    // 새 spot 추가 (tmp_ ID) — create 루프로 real ID 획득
    for (const [i, spot] of spotsData.entries()) {
      if (!spot.id.startsWith('tmp_')) continue;
      const created = await tx.spot.create({
        data: {
          storyId,
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

  redirect(`/story/${storyId}`);
}

export async function deleteStoryAction(storyId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) redirect(`/story/${storyId}`);

  await prisma.story.delete({ where: { id: storyId } });

  redirect('/story');
}
