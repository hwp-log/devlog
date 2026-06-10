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
    include: { user: true, tags: true, _count: { select: { likes: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export type StoryWithMeta = Awaited<ReturnType<typeof fetchStoriesWithMeta>>[number];
