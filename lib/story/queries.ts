import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { extractFirstImage } from '@/lib/story/extract-thumbnail';
import type { StoryCardProps } from '@/app/(protected)/story/_components/StoryCard';

// 한 페이지 크기 — fetchStoryPage 공용 단일 소스
export const STORY_PAGE_SIZE = 12;

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
      // 카드 대표: 첫 스팟(order asc)의 첫 작품(spotMovies createdAt desc) — 0185 대표 규칙.
      // 0437: storySpots take:1만 풀어 전체 스팟을 받는다 — 스팟별 대표작품(spotMovies[0])을
      // distinct 집계해 대표 칩에 "+N"을 붙이기 위함. spotMovies는 스팟당 대표 1개(take:1)면 충분 —
      // 장소가 겸하는 다른 촬영지(예: 롯데월드몰의 도깨비)는 이 글 주제가 아니라 세지 않는다.
      storySpots: {
        orderBy: { order: 'asc' },
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

/**
 * 스토리가 다루는 distinct 작품 수 — 카드 "+N" 신호 파생용(0437).
 * 스팟마다 대표작품 1개(spotMovies[0], 0185 규칙 = 카드 이름과 동일 기준)만 모아 센다.
 * 장소가 겸하는 다른 촬영지는 그 글의 주제가 아니므로 제외 → 이름과 +N이 한 규칙.
 */
function countDistinctWorks(storySpots: StoryWithMeta['storySpots']): number {
  const titles = new Set<string>();
  for (const ss of storySpots) {
    const rep = ss.spot.spotMovies[0]?.movie.title;
    if (rep) titles.add(rep);
  }
  return titles.size;
}

/** StoryWithMeta → 카드 props. 스토리 목록·마이스토리 공용 단일 매핑 소스. */
export function mapStoryToCard(story: StoryWithMeta): StoryCardProps {
  const spot = story.storySpots[0]?.spot;
  const work = spot?.spotMovies[0]?.movie.title ?? null;
  return {
    id: story.id,
    thumbnail: extractFirstImage(story.content),
    title: story.title,
    createdAt: story.createdAt,
    likeCount: story._count.likes,
    work,
    // 대표 외 나머지 distinct 작품 수. 대표(work)가 없으면 칩 자체가 안 뜨므로 0.
    extraWorkCount: work ? Math.max(0, countDistinctWorks(story.storySpots) - 1) : 0,
    location: spot?.name ?? null,
    // 첫 장소 외 나머지 장소 수 ("외 N곳" 신호). 장소가 없으면 0.
    // 작품 +N(spotMovies 대표작 distinct)과 세는 대상이 다름 — 여긴 순수 storySpots 개수.
    // storySpots는 0437에서 전량 로드 중이라 .length로 추가 쿼리·count 없이 산출한다.
    extraLocationCount: spot ? Math.max(0, story.storySpots.length - 1) : 0,
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
