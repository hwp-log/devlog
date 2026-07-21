import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { extractFirstImage } from '@/lib/story/extract-thumbnail';
import type { StoryCardProps } from '@/app/(protected)/story/_components/StoryCard';

// 한 페이지 크기 — fetchStoryPage 공용 단일 소스
export const STORY_PAGE_SIZE = 15;

function escapeILike(s: string) {
  return s.replace(/[%_\\]/g, '\\$&');
}

// where 단일 소스 — findMany(fetchStoriesWithMeta)와 count(fetchStoryPage)가 동일 필터 공유
function storyWhere({ userId, tag }: { userId?: string; tag?: string }): Prisma.StoryWhereInput {
  return {
    ...(userId ? { userId } : {}),
    ...(tag
      ? { tags: { some: { name: { contains: escapeILike(tag), mode: 'insensitive' } } } }
      : {}),
  };
}

export async function fetchStoriesWithMeta(options?: {
  userId?: string;
  tag?: string;
  skip?: number;
  take?: number;
}) {
  const { userId, tag, skip, take } = options ?? {};
  return prisma.story.findMany({
    where: storyWhere({ userId, tag }),
    ...(skip !== undefined ? { skip } : {}),
    ...(take !== undefined ? { take } : {}),
    include: {
      tags: true,
      _count: { select: { likes: true } },
      user: { select: { nickname: true, avatarUrl: true } },
      // 카드 배지·메타용 대표 스팟 1개(order asc). 작품은 상세페이지와 동일한 0185 대표 규칙(spotMovies createdAt desc 첫 번째).
      storySpots: {
        orderBy: { order: 'asc' },
        take: 1,
        select: {
          spot: {
            select: {
              name: true,
              spotMovies: { orderBy: { createdAt: 'desc' }, take: 1, select: { movie: { select: { title: true } } } },
            },
          },
        },
      },
    },
    // id 타이브레이커 — createdAt 동률(시드 데이터 등)에서도 결정적 순서 → offset 페이지네이션 dup/skip 방지
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

export type StoryWithMeta = Awaited<ReturnType<typeof fetchStoriesWithMeta>>[number];

/** StoryWithMeta → 카드 props. fetchStoryPage의 단일 매핑 소스. */
function mapStoryToCard(story: StoryWithMeta): StoryCardProps {
  const spot = story.storySpots[0]?.spot;
  return {
    id: story.id,
    thumbnail: extractFirstImage(story.content),
    title: story.title,
    createdAt: story.createdAt,
    likeCount: story._count.likes,
    work: spot?.spotMovies[0]?.movie.title ?? null,
    location: spot?.name ?? null,
  };
}

/**
 * 번호 페이지네이션용 한 페이지 조회. count 선행으로 totalPages 산출 → page를 [1,totalPages]로 클램프(over-range URL 방어).
 * 반환 page = 실제(클램프된) 페이지. 서버 주도(page.tsx가 searchParams로 호출) — 단일 데이터 경로.
 */
export async function fetchStoryPage(options: {
  userId?: string;
  keyword?: string;
  page: number;
}): Promise<{ items: StoryCardProps[]; totalPages: number; page: number }> {
  const { userId, keyword, page } = options;
  const tag = keyword || undefined;
  const total = await prisma.story.count({ where: storyWhere({ userId, tag }) });
  const totalPages = Math.max(1, Math.ceil(total / STORY_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rows = await fetchStoriesWithMeta({
    userId,
    tag,
    skip: (safePage - 1) * STORY_PAGE_SIZE,
    take: STORY_PAGE_SIZE,
  });
  return { items: rows.map(mapStoryToCard), totalPages, page: safePage };
}

export async function fetchPopularTags(limit = 8): Promise<string[]> {
  const tags = await prisma.tag.findMany({
    where: { stories: { some: {} } },
    orderBy: { stories: { _count: 'desc' } },
    take: limit,
    select: { name: true },
  });
  return tags.map((t) => t.name);
}

export async function fetchMyStoryTags(userId: string, limit = 8): Promise<string[]> {
  const tags = await prisma.tag.findMany({
    where: { stories: { some: { userId } } },
    select: {
      name: true,
      _count: { select: { stories: { where: { userId } } } },
    },
  });
  return tags
    .sort((a, b) => b._count.stories - a._count.stories)
    .slice(0, limit)
    .map((t) => t.name);
}
