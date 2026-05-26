'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

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
