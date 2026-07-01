import { prisma } from '@/lib/prisma';

function escapeILike(s: string) {
  return s.replace(/[%_\\]/g, '\\$&');
}

export async function fetchStoriesWithMeta(options?: {
  userId?: string;
  tag?: string;
}) {
  const { userId, tag } = options ?? {};
  return prisma.story.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(tag
        ? { tags: { some: { name: { contains: escapeILike(tag), mode: 'insensitive' } } } }
        : {}),
    },
    include: { tags: true, _count: { select: { likes: true } }, user: { select: { nickname: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export type StoryWithMeta = Awaited<ReturnType<typeof fetchStoriesWithMeta>>[number];

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
