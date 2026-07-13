'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin/guard';

type ActionResult = { ok: true } | { error: string };

async function guard(): Promise<{ error: string } | null> {
  try {
    await requireAdmin();
    return null;
  } catch {
    return { error: '관리자 권한이 필요합니다' };
  }
}

export async function approveMovie(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  await prisma.movie.update({
    where: { id },
    data: { status: 'APPROVED' },
  });
  revalidatePath('/admin');
  return { ok: true };
}

export async function unapproveMovie(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const target = await prisma.movie.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!target) return { error: '작품을 찾을 수 없습니다' };
  if (target.status !== 'APPROVED') {
    return { error: '이미 대기 상태인 작품입니다' };
  }

  await prisma.movie.update({
    where: { id },
    data: { status: 'PENDING' },
  });
  revalidatePath('/admin');
  return { ok: true };
}

export async function rejectMovie(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  await prisma.$transaction(async (tx) => {
    await tx.spot.updateMany({
      where: { movieId: id },
      data: { movieId: null },
    });
    // dual-write (S1): spot_movies에서 해당 작품 링크 제거 (movie 삭제 시 FK CASCADE로도 제거되나 대칭 위해 명시)
    await tx.spotMovie.deleteMany({ where: { movieId: id } });
    await tx.movie.delete({ where: { id } });
  });

  revalidatePath('/admin');
  return { ok: true };
}

export async function mergeMovie(
  pendingId: string,
  targetId: string,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  if (pendingId === targetId) return { error: '동일한 작품으로 병합할 수 없습니다' };

  const [pending, target] = await Promise.all([
    prisma.movie.findUnique({ where: { id: pendingId }, select: { status: true } }),
    prisma.movie.findUnique({ where: { id: targetId }, select: { status: true } }),
  ]);
  if (!pending || pending.status !== 'PENDING') {
    return { error: '병합 대상이 대기 중인 작품이 아닙니다' };
  }
  if (!target || target.status !== 'APPROVED') {
    return { error: '병합 목적지가 승인된 작품이 아닙니다' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.spot.updateMany({
      where: { movieId: pendingId },
      data: { movieId: targetId },
    });
    // dual-write (S1): spot_movies 재지정 pending → target.
    // 이미 target을 가진 spot은 @@unique(spotId,movieId) 충돌 → 해당 pending 행 삭제로 흡수, 나머지 이관.
    // (movie.delete가 pending 링크를 CASCADE 삭제하므로 반드시 delete 전에 수행)
    const targetSpotIds = (
      await tx.spotMovie.findMany({ where: { movieId: targetId }, select: { spotId: true } })
    ).map((r) => r.spotId);
    if (targetSpotIds.length > 0) {
      await tx.spotMovie.deleteMany({ where: { movieId: pendingId, spotId: { in: targetSpotIds } } });
    }
    await tx.spotMovie.updateMany({ where: { movieId: pendingId }, data: { movieId: targetId } });
    await tx.movie.delete({ where: { id: pendingId } });
  });

  revalidatePath('/admin');
  return { ok: true };
}

export async function renameMovie(id: string, title: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const trimmed = title.trim();
  if (!trimmed) return { error: '제목을 입력해주세요' };

  const duplicate = await prisma.movie.findFirst({
    where: { title: trimmed, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) return { error: '동일한 제목의 작품이 이미 존재합니다' };

  await prisma.movie.update({
    where: { id },
    data: { title: trimmed },
  });
  revalidatePath('/admin');
  return { ok: true };
}
