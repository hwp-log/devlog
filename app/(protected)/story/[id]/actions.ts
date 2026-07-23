'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { extractStoragePath, resolvePhotoIntent } from '@/lib/story/photo-cleanup';
import { findNearestTransit } from '@/lib/spot/autoTransit';
import { clampRating } from '@/lib/spot/rating';
import {
  MAX_TITLE_LEN, MAX_CONTENT_LEN, MAX_TAGS, MAX_TAG_LEN, MAX_SPOTS, MAX_SPOT_NAME_LEN,
  parseTags, parseSpots,
} from '@/lib/story/parse-input';
import { cleanEmptySections } from '@/lib/story/clean-empty-sections';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

type ActionState = { error: string } | null;

// S3-a 후속: owned 스팟 삭제 전, "다른 스토리(storyId≠this)의 story_spots가 참조 중"인 spotId를 찾는다.
// 참조 있으면 하드삭제 대신 storyId=null로 orphan(공유 스팟 편입) — Spot→StorySpot Cascade로 타 스토리
// 여행동선이 사라지는 소실 방지. (반환된 id는 삭제 대신 storyId=null 처리 대상.)
async function findSharedOwnedSpotIds(
  tx: Prisma.TransactionClient,
  ownedSpotIds: string[],
  thisStoryId: string,
): Promise<string[]> {
  if (ownedSpotIds.length === 0) return [];
  const refs = await tx.storySpot.findMany({
    where: { spotId: { in: ownedSpotIds }, storyId: { not: thisStoryId } },
    select: { spotId: true },
    distinct: ['spotId'],
  });
  return refs.map((r) => r.spotId);
}

export async function updateStoryAction(storyId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) return { error: '수정 권한이 없습니다' };

  const title = formData.get('title')?.toString().trim() ?? '';
  // 내용 없는 섹션(프리필 골격 잔재) 정리 후 검증 — 결과가 빈 문자열이면 아래 !content 체크에 걸림
  const content = cleanEmptySections(formData.get('content')?.toString().trim() ?? '');
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

  // DB 스냅샷: 사진 비우기/교체 판정용 구 photoUrl (트랜잭션 전 확보)
  const existingSpots = await prisma.spot.findMany({
    where: { storyId },
    select: { id: true, photoUrl: true },
  });
  const oldPhotoUrlById = new Map(existingSpots.map((s) => [s.id, s.photoUrl]));
  const clearedPhotoPaths: string[] = [];

  // 재사용 스팟 per-visit 구 사진 스냅샷(replace/clear 시 구 storage 파일 삭제용).
  // oldPhotoUrlById는 where:{storyId}의 Spot.photoUrl 기반이라 storyId≠this인 공유 스팟은 못 담음 → StorySpot에서 별도 확보.
  const reusedIds = spotsData.filter((s) => s.reusedSpotId).map((s) => s.reusedSpotId!);
  const oldReusedPhotoBySpotId = new Map<string, string | null>();
  if (reusedIds.length > 0) {
    const rows = await prisma.storySpot.findMany({
      where: { storyId, spotId: { in: reusedIds } },
      select: { spotId: true, photoUrl: true },
    });
    rows.forEach((r) => oldReusedPhotoBySpotId.set(r.spotId, r.photoUrl));
  }

  // 교통 기준점 자동 계산 — 트랜잭션 전 전처리 (외부 API를 tx 안에서 호출하면 tx 홀딩).
  // 기저장 값 재사용: 수정 흐름은 DB 값을 폼 payload로 되돌려 보냄(StoryWriteForm) —
  // 이 분기가 없으면 수정 저장마다 전 스팟 재계산. 실패는 null로 흡수 — 저장을 절대 막지 않음
  for (const spot of spotsData) {
    if (spot.reusedSpotId) continue; // 재사용: 공유 Spot의 교통값 그대로 — 재계산·저장 안 함
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

      // S3-a 분류: reused(reusedSpotId 有)=공유 Spot 참조(생성·수정·삭제 안 함) /
      //   owned(non-tmp, non-reused)=이 스토리 소유(수정) / new(tmp_, non-reused)=생성.
      // owned real id만 추출 — 재사용 real id를 owned로 오인하면 공유 스팟 삭제·수정됨.
      const ownedRealIds = spotsData
        .filter((s) => !s.id.startsWith('tmp_') && !s.reusedSpotId)
        .map((s) => s.id);

      // 제출 목록에서 빠진 owned spot 중 "다른 스토리가 재사용 중"인 것은 삭제 대신 orphan(storyId=null).
      // orphan은 아래 deleteMany({storyId})·재도출 derived(storyId) 스코프에서 자동 제외(실측 확인) → 타 스토리 조인·spot_movies 보존.
      const removedOwned = await tx.spot.findMany({ where: { storyId, id: { notIn: ownedRealIds } }, select: { id: true } });
      const sharedRemoved = await findSharedOwnedSpotIds(tx, removedOwned.map((s) => s.id), storyId);
      if (sharedRemoved.length > 0) {
        await tx.spot.updateMany({ where: { id: { in: sharedRemoved } }, data: { storyId: null } });
      }
      // 제출 목록에 없는 이 스토리의 owned spot 삭제 (재사용 스팟·orphan된 스팟은 미접촉)
      await tx.spot.deleteMany({ where: { storyId, id: { notIn: ownedRealIds } } });

      // 기존 owned spot 업데이트 (재사용 스팟은 수정 안 함 — 공유 행 오염 방지)
      for (const [i, spot] of spotsData.entries()) {
        if (!spot.id.startsWith('tmp_') && !spot.reusedSpotId) {
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

      // 새 spot 추가 (tmp_ ID, 재사용 아님) — create 루프로 real ID 획득
      for (const [i, spot] of spotsData.entries()) {
        if (!spot.id.startsWith('tmp_') || spot.reusedSpotId) continue;
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
      // S3-a: 재사용 스팟 target id — story_spots deleteMany의 notIn에 합쳐 재사용 조인이 편집마다 안 지워지게.
      const reusedSpotIds = spotsData.filter((s) => s.reusedSpotId).map((s) => s.reusedSpotId!);
      // 0208: 이 스토리에서 떨어져 나갈 storySpot의 spotId를 deleteMany 전에 캡처 (참조 0 청소 후보).
      const droppedRefSpotIds = (
        await tx.storySpot.findMany({
          where: { storyId, spotId: { notIn: [...derivedSpotIds, ...reusedSpotIds] } },
          select: { spotId: true },
          distinct: ['spotId'],
        })
      ).map((r) => r.spotId);
      await tx.storySpot.deleteMany({ where: { storyId, spotId: { notIn: [...derivedSpotIds, ...reusedSpotIds] } } });
      // rating은 Spot 컬럼이 아니라 StorySpot에만 존재 → derived(Spot 조회)로 안 흐름.
      // payload(spotsData)에서 실 spotId(재사용=reusedSpotId / 신규=tmpToReal / owned=id)로 매핑해 upsert에 스레딩.
      const ratingBySpotId = new Map<string, number | null>();
      for (const sp of spotsData) {
        const realId = sp.reusedSpotId ?? (sp.id.startsWith('tmp_') ? tmpToReal.find((t) => t.tmpId === sp.id)?.realId : sp.id);
        if (realId) ratingBySpotId.set(realId, clampRating(sp.rating));
      }
      for (const r of derived) {
        const rating = ratingBySpotId.get(r.id) ?? null; // update에 포함 → 편집 시 별점 갱신 가능(정정)
        await tx.storySpot.upsert({
          where: { storyId_spotId: { storyId, spotId: r.id } },
          update: { order: r.order, review: r.review, photoUrl: r.photoUrl, rating },
          create: { storyId, spotId: r.id, order: r.order, review: r.review, photoUrl: r.photoUrl, rating },
        });
      }
      // spot_movies (owned+new): delete→create 유지 — derived(storyId=this)만 스코프라 재사용 시딩 스팟 description 무접촉.
      // 표지(S3): 스팟 공유로 storyId=null이 되면 이 스코프가 깨질 수 있음 → 그때 upsert 재검토(S3-b).
      await tx.spotMovie.deleteMany({ where: { spotId: { in: derivedSpotIds } } });
      const withMovie = derived.filter((r) => r.movieId);
      if (withMovie.length > 0) {
        await tx.spotMovie.createMany({
          data: withMovie.map((r) => ({ spotId: r.id, movieId: r.movieId! })),
        });
      }
      // S3-a 재사용 스팟: 방문 기록(StorySpot)만 upsert. 작품(SpotMovie)은 안 씀 — 공유 자산이라
      // 방문 스토리가 공유 장소의 작품을 바꾸면 전원에 영향(작품 편집 불가 정책). 공유 Spot·spot_movies 미접촉.
      for (const [i, spot] of spotsData.entries()) {
        if (!spot.reusedSpotId) continue;
        await tx.storySpot.upsert({
          where: { storyId_spotId: { storyId, spotId: spot.reusedSpotId } },
          update: { order: i + 1, review: spot.review ?? null, rating: clampRating(spot.rating) },
          create: { storyId, spotId: spot.reusedSpotId, order: i + 1, review: spot.review ?? null, photoUrl: null, rating: clampRating(spot.rating) },
        });
      }
      // 0208: 모든 storySpot 재도출 뒤 마지막에 실행. 편집에서 빠져 참조 0이 된 user orphan 스팟만 삭제.
      // seed·타 스토리 참조(방금 재사용 포함, story_spots none 판정)·소유 스팟은 조건에서 탈락.
      if (droppedRefSpotIds.length > 0) {
        await tx.spot.deleteMany({
          where: { id: { in: droppedRefSpotIds }, storyId: null, source: 'user', storySpots: { none: {} } },
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

  // real spot 사진 교체 (부분 실패 허용). 재사용 스팟은 공유 Spot.photoUrl 미수정 (per-visit 사진은 story_spots.photoUrl에 별도 미러 — 아래 재사용 루프, 0214)
  for (const spot of spotsData) {
    if (spot.id.startsWith('tmp_') || spot.reusedSpotId) continue;
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

  // 0214: 재사용 스팟 per-visit 사진 — 공유 Spot.photoUrl 미수정, story_spots.photoUrl에만 기록(NEW:151 대칭).
  //       replace/clear 판정은 owned와 동일(resolvePhotoIntent). keep은 무동작 — 재사용 upsert가 update에서 photoUrl 생략해 기존값 보존.
  for (const spot of spotsData) {
    if (!spot.reusedSpotId) continue;
    const reusedId = spot.reusedSpotId;
    const file = formData.get(`spotPhoto_${spot.id}`);
    const oldUrl = oldReusedPhotoBySpotId.get(reusedId) ?? null;
    const intent = resolvePhotoIntent(oldUrl, spot.photoUrl, file instanceof File);

    if (intent === 'replace') {
      const ext = (file as File).name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/spot/${reusedId}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('story-photos')
        .upload(path, file as File, { upsert: true });
      if (uploadError) continue;
      const { data: { publicUrl } } = supabase.storage.from('story-photos').getPublicUrl(uploadData.path);
      await prisma.storySpot.updateMany({ where: { storyId, spotId: reusedId }, data: { photoUrl: publicUrl } });
      // 교체 성공 후에만 구 per-visit 파일 삭제
      if (oldUrl) {
        const oldPath = extractStoragePath(oldUrl);
        if (oldPath) await supabase.storage.from('story-photos').remove([oldPath]);
      }
    } else if (intent === 'clear') {
      await prisma.storySpot.updateMany({ where: { storyId, spotId: reusedId }, data: { photoUrl: null } });
      const oldPath = extractStoragePath(oldUrl!);
      if (oldPath) await supabase.storage.from('story-photos').remove([oldPath]);
    }
  }

  redirect(`/story/${storyId}`);
}

export async function toggleLikeAction(storyId: string): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');

  // 미존재 storyId 사전 가드 — like.create의 FK 에러(P2003) 500 방지 (사전 조회 가드 선례)
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true } });
  if (!story) throw new Error('스토리를 찾을 수 없습니다');

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

  // owned 스팟 중 "다른 스토리가 재사용 중"인 것은 story.delete cascade 전에 orphan(storyId=null)으로 전환해
  // Spot→StorySpot Cascade로 타 스토리 여행동선이 사라지는 것을 방지. 전환은 반드시 delete보다 먼저(같은 tx).
  await prisma.$transaction(async (tx) => {
    const owned = await tx.spot.findMany({ where: { storyId }, select: { id: true } });
    const shared = await findSharedOwnedSpotIds(tx, owned.map((s) => s.id), storyId);
    if (shared.length > 0) {
      await tx.spot.updateMany({ where: { id: { in: shared } }, data: { storyId: null } });
    }
    // 0208: 청소 후보 = 이 스토리가 참조하던 spotId. story.delete cascade로 story_spots가 0이 될 수 있어 delete 전 캡처.
    const refSpotIds = (
      await tx.storySpot.findMany({ where: { storyId }, select: { spotId: true }, distinct: ['spotId'] })
    ).map((r) => r.spotId);

    await tx.story.delete({ where: { id: storyId } });

    // 0208: orphan 전환·cascade 뒤에만 실행. 참조 0(story_spots none) + 주인 없음(storyId null) + user 인 후보만 삭제.
    // seed 촬영지·타 스토리 참조 스팟은 조건에서 탈락. 조인·작품은 Spot FK Cascade로 자동 정리.
    if (refSpotIds.length > 0) {
      await tx.spot.deleteMany({
        where: { id: { in: refSpotIds }, storyId: null, source: 'user', storySpots: { none: {} } },
      });
    }
  });

  redirect('/story');
}
