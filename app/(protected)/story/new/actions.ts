'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { findNearestTransit } from '@/lib/spot/autoTransit';
import { clampRating } from '@/lib/spot/rating';
import {
  MAX_TITLE_LEN, MAX_CONTENT_LEN, MAX_TAGS, MAX_TAG_LEN, MAX_SPOTS, MAX_SPOT_NAME_LEN,
  parseTags, parseSpots,
} from '@/lib/story/parse-input';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

type ActionState = { error: string } | null;

export async function createStoryAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = formData.get('title')?.toString().trim() ?? '';
  const content = formData.get('content')?.toString().trim() ?? '';
  const tagNames = parseTags(formData.get('tags')?.toString() ?? '');
  const spotsData = parseSpots(formData.get('spots')?.toString() ?? '');
  if (!tagNames || !spotsData) return { error: '잘못된 요청입니다. 새로고침 후 다시 시도해주세요' };

  const planIdRaw = formData.get('plan_id')?.toString().trim() ?? '';
  const planId = planIdRaw || null;

  if (!title) return { error: '제목을 입력해주세요' };
  if (!content) return { error: '본문을 입력해주세요' };
  if (title.length > MAX_TITLE_LEN) return { error: `제목은 ${MAX_TITLE_LEN}자 이하로 입력해주세요` };
  if (content.length > MAX_CONTENT_LEN) return { error: `본문은 ${MAX_CONTENT_LEN}자 이하로 입력해주세요` };
  if (tagNames.length > MAX_TAGS) return { error: `태그는 ${MAX_TAGS}개까지 입력할 수 있습니다` };
  if (tagNames.some((t) => t.length > MAX_TAG_LEN)) return { error: `태그는 ${MAX_TAG_LEN}자 이하로 입력해주세요` };
  if (spotsData.length > MAX_SPOTS) return { error: `스팟은 ${MAX_SPOTS}개까지 추가할 수 있습니다` };
  if (spotsData.some((s) => s.name.length > MAX_SPOT_NAME_LEN)) return { error: `장소명은 ${MAX_SPOT_NAME_LEN}자 이하로 입력해주세요` };

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

  // 교통 기준점 자동 계산 — 트랜잭션 전 전처리 (외부 API를 tx 안에서 호출하면 tx 홀딩).
  // 기저장 값 재사용: 값이 실려 오면 재계산 회피 (신규 흐름은 항상 미전달 — 방어 겸 수정 액션과 대칭).
  // 실패는 null로 흡수 — 저장을 절대 막지 않음
  for (const spot of spotsData) {
    if (spot.reusedSpotId) continue; // 재사용: 공유 Spot의 교통값 그대로 — 재계산·저장 안 함
    if (spot.nearestStation != null || spot.transitMinutes != null) continue;
    const auto = await findNearestTransit(spot.lat, spot.lng);
    spot.nearestStation = auto?.nearestStation ?? null;
    spot.transitMinutes = auto?.transitMinutes ?? null;
    spot.transitMode = auto?.transitMode ?? null;
  }

  // 트랜잭션: Story + Spots 생성, real spotId 획득. reused = 재사용 스팟(공유 Spot이라 사진 미러 시 Spot 미수정)
  const tmpToReal: Array<{ tmpId: string; realId: string; reused: boolean }> = [];

  let story;
  try {
    story = await prisma.$transaction(async (tx) => {
      const s = await tx.story.create({
        data: {
          title,
          content,
          photoUrl: null,
          userId: user.id,
          planId,
          tags: {
            connectOrCreate: tagNames.map((name) => ({
              where: { name },
              create: { name },
            })),
          },
        },
      });

      for (const [i, spot] of spotsData.entries()) {
        // S3-a: 재사용이면 기존 공유 Spot 참조(생성 안 함), 아니면 신규 Spot 생성.
        let targetSpotId: string;
        if (spot.reusedSpotId) {
          targetSpotId = spot.reusedSpotId;
        } else {
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
              movieId: spot.movieId ?? null,
              nearestStation: spot.nearestStation ?? null,
              transitMinutes: spot.transitMinutes ?? null,
              transitMode: spot.transitMode ?? null,
            },
          });
          targetSpotId = created.id;
        }
        tmpToReal.push({ tmpId: spot.id, realId: targetSpotId, reused: !!spot.reusedSpotId });

        // dual-write (S1): story_spots(per-visit) + spot_movies. photoUrl은 tx 밖 업로드 후 갱신.
        // 재사용 스팟도 방문 기록(StorySpot)·작품 링크는 추가 — 단 SpotMovie는 upsert(기존 링크 충돌·description 보존).
        await tx.storySpot.create({
          data: { storyId: s.id, spotId: targetSpotId, order: i + 1, review: spot.review ?? null, photoUrl: null, rating: clampRating(spot.rating) },
        });
        // 재사용(공유) 스팟은 작품을 쓰지 않음 — 공유 자산 오염 방지(작품 편집 불가 정책). 신규/owned만 기록.
        if (spot.movieId && !spot.reusedSpotId) {
          await tx.spotMovie.upsert({
            where: { spotId_movieId: { spotId: targetSpotId, movieId: spot.movieId } },
            create: { spotId: targetSpotId, movieId: spot.movieId },
            update: {},
          });
        }
      }

      return s;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: '이미 다른 스토리에 연결된 플랜입니다.' };
    }
    throw e;
  }

  // 트랜잭션 바깥: Storage 업로드 (부분 실패 허용)
  for (const { tmpId, realId, reused } of tmpToReal) {
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

    // 재사용 스팟은 공유 Spot.photoUrl을 건드리지 않음 — 이 방문 사진은 story_spots.photoUrl(per-visit)에만.
    if (!reused) {
      await prisma.spot.update({ where: { id: realId }, data: { photoUrl: publicUrl } });
    }
    await prisma.storySpot.updateMany({ where: { storyId: story.id, spotId: realId }, data: { photoUrl: publicUrl } });
  }

  redirect(`/story/${story.id}`);
}
