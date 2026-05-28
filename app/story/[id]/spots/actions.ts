'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function getSpotWithOwnership(spotId: string, userId: string) {
  const spot = await prisma.spot.findUnique({
    where: { id: spotId },
    include: { story: { select: { userId: true, id: true } } },
  });
  if (!spot || spot.story.userId !== userId) return null;
  return spot;
}

export async function createSpot(
  storyId: string,
  data: { name: string; lng: number; lat: number }
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) return { error: '권한이 없습니다' };

  const spotCount = await prisma.spot.count({ where: { storyId } });

  await prisma.spot.create({
    data: { storyId, name: data.name, lng: data.lng, lat: data.lat, order: spotCount + 1 },
  });

  revalidatePath(`/story/${storyId}`);
  revalidatePath(`/story/${storyId}/edit`);
  return { ok: true };
}

export async function reorderSpots(
  storyId: string,
  spotIds: string[]
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) return { error: '권한이 없습니다' };

  const count = await prisma.spot.count({ where: { id: { in: spotIds }, storyId } });
  if (count !== spotIds.length) return { error: '잘못된 요청입니다' };

  await prisma.$transaction(
    spotIds.map((spotId, i) =>
      prisma.spot.update({
        where: { id: spotId, storyId },
        data: { order: i + 1 },
      })
    )
  );

  revalidatePath(`/story/${storyId}`);
  revalidatePath(`/story/${storyId}/edit`);
  return { ok: true };
}

export async function uploadSpotPhoto(
  spotId: string,
  formData: FormData
): Promise<{ error: string } | { ok: true; photoUrl: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const spot = await getSpotWithOwnership(spotId, user.id);
  if (!spot) return { error: '권한이 없습니다' };

  const file = formData.get('file') as File | null;
  if (!file) return { error: '파일이 없습니다' };
  if (file.size > MAX_SIZE) return { error: '파일 크기는 5MB 이하여야 합니다' };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: 'jpeg, png, webp만 허용됩니다' };

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${user.id}/spot/${spotId}/${Date.now()}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('story-photos')
    .upload(path, file, { upsert: true });
  if (uploadError) return { error: '업로드 실패' };

  const { data: { publicUrl } } = supabase.storage
    .from('story-photos')
    .getPublicUrl(uploadData.path);

  await prisma.spot.update({ where: { id: spotId }, data: { photoUrl: publicUrl } });

  revalidatePath(`/story/${spot.story.id}`);
  revalidatePath(`/story/${spot.story.id}/edit`);
  return { ok: true, photoUrl: publicUrl };
}

export async function updateSpot(
  spotId: string,
  data: { name?: string; review?: string }
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const spot = await getSpotWithOwnership(spotId, user.id);
  if (!spot) return { error: '권한이 없습니다' };

  await prisma.spot.update({ where: { id: spotId }, data });

  revalidatePath(`/story/${spot.story.id}`);
  revalidatePath(`/story/${spot.story.id}/edit`);
  return { ok: true };
}

export async function clearSpotPhoto(
  spotId: string
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const spot = await getSpotWithOwnership(spotId, user.id);
  if (!spot) return { error: '권한이 없습니다' };

  if (spot.photoUrl) {
    const url = new URL(spot.photoUrl);
    const prefix = '/storage/v1/object/public/story-photos/';
    const storagePath = url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length)
      : null;
    if (storagePath) {
      await supabase.storage.from('story-photos').remove([storagePath]);
    }
  }

  await prisma.spot.update({ where: { id: spotId }, data: { photoUrl: null } });

  revalidatePath(`/story/${spot.story.id}`);
  revalidatePath(`/story/${spot.story.id}/edit`);
  return { ok: true };
}

export async function deleteSpot(
  spotId: string
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const spot = await getSpotWithOwnership(spotId, user.id);
  if (!spot) return { error: '권한이 없습니다' };

  const storyId = spot.story.id;

  await prisma.$transaction(async (tx) => {
    await tx.spot.delete({ where: { id: spotId } });
    const remaining = await tx.spot.findMany({
      where: { storyId },
      orderBy: { order: 'asc' },
    });
    await Promise.all(
      remaining.map((s, i) => tx.spot.update({ where: { id: s.id }, data: { order: i + 1 } }))
    );
  });

  revalidatePath(`/story/${storyId}`);
  revalidatePath(`/story/${storyId}/edit`);
  return { ok: true };
}
