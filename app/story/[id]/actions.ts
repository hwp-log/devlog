'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { LocalSpot } from '@/lib/types';
import { extractStoragePath, resolvePhotoIntent } from '@/lib/story/photo-cleanup';
import { findNearestTransit } from '@/lib/spot/autoTransit';

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
  const planIdRaw = formData.get('plan_id')?.toString().trim() ?? '';
  const planId = planIdRaw || null;

  if (!title) return { error: '제목을 입력해주세요' };
  if (!content) return { error: '본문을 입력해주세요' };

  if (planId) {
    const plan = await prisma.myPlan.findUnique({ where: { id: planId }, select: { ownerId: true } });
    if (!plan || plan.ownerId !== user.id) return { error: '유효하지 않은 플랜입니다.' };
  }

  // 파일 검증 (트랜잭션 전)
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('spotPhoto_') || !(value instanceof File)) continue;
    if (value.size > MAX_SIZE) return { error: '파일 크기는 5MB 이하여야 합니다' };
    if (!ALLOWED_TYPES.includes(value.type)) return { error: 'jpeg, png, webp만 허용됩니다' };
  }

  // DB 스냅샷: 사진 비우기/교체 판정용 구 photoUrl (트랜잭션 전 확보)
  const existingSpots = await prisma.spot.findMany({
    where: { storyId },
    select: { id: true, photoUrl: true },
  });
  const oldPhotoUrlById = new Map(existingSpots.map((s) => [s.id, s.photoUrl]));
  const clearedPhotoPaths: string[] = [];

  // 교통 기준점 자동 계산 — 트랜잭션 전 전처리 (외부 API를 tx 안에서 호출하면 tx 홀딩).
  // 기저장 값 재사용: 수정 흐름은 DB 값을 폼 payload로 되돌려 보냄(StoryWriteForm) —
  // 이 분기가 없으면 수정 저장마다 전 스팟 재계산. 실패는 null로 흡수 — 저장을 절대 막지 않음
  for (const spot of spotsData) {
    if (spot.nearestStation != null || spot.transitMinutes != null) continue;
    const auto = await findNearestTransit(spot.lat, spot.lng);
    spot.nearestStation = auto?.nearestStation ?? null;
    spot.transitMinutes = auto?.transitMinutes ?? null;
    spot.transitMode = auto?.transitMode ?? null;
  }

  // 트랜잭션: Story 업데이트 + Spots 동기화, 신규 spot real ID 획득
  const tmpToReal: Array<{ tmpId: string; realId: string }> = [];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.story.update({
        where: { id: storyId },
        data: {
          title,
          content,
          planId,
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
          const hasPendingFile = formData.get(`spotPhoto_${spot.id}`) instanceof File;
          // photoUrl:null + 파일 부재 = 비우기 의도의 파생 판정 (DB 스냅샷 vs 제출 payload의 diff 기반)
          const oldUrl = oldPhotoUrlById.get(spot.id) ?? null;
          if (resolvePhotoIntent(oldUrl, spot.photoUrl, hasPendingFile) === 'clear') {
            const path = extractStoragePath(oldUrl!);
            if (path) clearedPhotoPaths.push(path);
          }
          await tx.spot.update({
            where: { id: spot.id },
            data: {
              order: i + 1,
              name: spot.name,
              review: spot.review ?? null,
              photoUrl: hasPendingFile ? undefined : (spot.photoUrl ?? null),
              movieId: spot.movieId ?? null,
              nearestStation: spot.nearestStation ?? null,
              transitMinutes: spot.transitMinutes ?? null,
              transitMode: spot.transitMode ?? null,
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
            movieId: spot.movieId ?? null,
            nearestStation: spot.nearestStation ?? null,
            transitMinutes: spot.transitMinutes ?? null,
            transitMode: spot.transitMode ?? null,
          },
        });
        tmpToReal.push({ tmpId: spot.id, realId: created.id });
      }

      // dual-write (S1): 이 story의 최종 spots로부터 story_spots·spot_movies 재도출 (멱등).
      // photoUrl은 tx 밖 업로드/교체 시 별도 미러 (아래). 삭제된 spot의 조인은 spot FK CASCADE로 이미 제거됨
      const derived = await tx.spot.findMany({
        where: { storyId },
        select: { id: true, order: true, review: true, photoUrl: true, movieId: true },
      });
      // story_spots: (storyId, spotId) upsert — 기존 행·id 보존 (편집 시 per-visit 필드[미래 rating] 소실 방지).
      // 제거된 스팟의 story_spots는 spot FK CASCADE(위 spot deleteMany)로 이미 삭제되나, 자기완결·방어적으로 명시 삭제.
      // 표지: 스팟 수만큼 순차 upsert(N쿼리). 현재 스토리당 스팟 소수라 무해 — 많아지면 Promise.all/raw SQL ON CONFLICT 검토.
      const derivedSpotIds = derived.map((r) => r.id);
      await tx.storySpot.deleteMany({ where: { storyId, spotId: { notIn: derivedSpotIds } } });
      for (const r of derived) {
        await tx.storySpot.upsert({
          where: { storyId_spotId: { storyId, spotId: r.id } },
          update: { order: r.order, review: r.review, photoUrl: r.photoUrl },
          create: { storyId, spotId: r.id, order: r.order, review: r.review, photoUrl: r.photoUrl },
        });
      }
      // spot_movies는 재도출(delete→create) 유지 — 검증상 story 편집이 description을 손상하지 않음
      // (description은 seed 스팟[storyId=null]에만 있고, 이 재도출은 storyId=this 스팟만 스코프).
      // 표지(S3): 스팟 공유로 storyId=null이 되면 seed/story 구분이 사라져 description 소실 가능 → 그때 upsert 재검토.
      await tx.spotMovie.deleteMany({ where: { spotId: { in: derivedSpotIds } } });
      const withMovie = derived.filter((r) => r.movieId);
      if (withMovie.length > 0) {
        await tx.spotMovie.createMany({
          data: withMovie.map((r) => ({ spotId: r.id, movieId: r.movieId! })),
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: '이미 다른 스토리에 연결된 플랜입니다.' };
    }
    throw e;
  }

  // 트랜잭션 바깥: 비운 사진의 Storage 파일 삭제 (DB null 확정 후 물리 삭제 — 부분 실패 허용)
  if (clearedPhotoPaths.length > 0) {
    await supabase.storage.from('story-photos').remove(clearedPhotoPaths);
  }

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
    // dual-write (S1): story_spots.photoUrl 미러
    await prisma.storySpot.updateMany({ where: { storyId, spotId: realId }, data: { photoUrl: publicUrl } });
  }

  // real spot 사진 교체 (부분 실패 허용)
  for (const spot of spotsData) {
    if (spot.id.startsWith('tmp_')) continue;
    const file = formData.get(`spotPhoto_${spot.id}`);
    if (!(file instanceof File)) continue;

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/spot/${spot.id}/${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('story-photos')
      .upload(path, file, { upsert: true });
    if (uploadError) continue;

    const { data: { publicUrl } } = supabase.storage
      .from('story-photos')
      .getPublicUrl(uploadData.path);

    await prisma.spot.update({ where: { id: spot.id }, data: { photoUrl: publicUrl } });
    // dual-write (S1): story_spots.photoUrl 미러
    await prisma.storySpot.updateMany({ where: { storyId, spotId: spot.id }, data: { photoUrl: publicUrl } });

    // 교체 성공(업로드 + DB 갱신) 후에만 구 파일 삭제 — 업로드 실패 시 구 파일 보존
    const oldUrl = oldPhotoUrlById.get(spot.id);
    if (oldUrl) {
      const oldPath = extractStoragePath(oldUrl);
      if (oldPath) await supabase.storage.from('story-photos').remove([oldPath]);
    }
  }

  redirect(`/story/${storyId}`);
}

export async function toggleLikeAction(storyId: string): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');

  const existing = await prisma.like.findUnique({
    where: { storyId_userId: { storyId, userId: user.id } },
  });

  let liked: boolean;
  if (existing) {
    await prisma.like.delete({
      where: { storyId_userId: { storyId, userId: user.id } },
    });
    liked = false;
  } else {
    try {
      await prisma.like.create({ data: { storyId, userId: user.id } });
      liked = true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        liked = true;
      } else {
        throw e;
      }
    }
  }

  const count = await prisma.like.count({ where: { storyId } });
  revalidatePath('/story');
  return { liked, count };
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
