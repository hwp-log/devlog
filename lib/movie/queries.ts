import 'server-only';
import { prisma } from '@/lib/prisma';

export type MovieSuggestion = {
  id: string;
  title: string;
  spotCount: number;
};

function normalizeForSearch(s: string) {
  return s.toLowerCase().replace(/\s+/g, '');
}

function escapeLike(s: string) {
  return s.replace(/[%_\\]/g, '\\$&');
}

export async function searchMovies(
  rawQuery: string,
  limit: number = 8,
): Promise<MovieSuggestion[]> {
  const normalized = escapeLike(normalizeForSearch(rawQuery));
  if (!normalized) return [];

  const pattern = `%${normalized}%`;

  const rows = await prisma.$queryRaw<
    Array<{ id: string; title: string; spot_count: bigint }>
  >`
    SELECT m.id, m.title, COUNT(s.id) AS spot_count
    FROM movies m
    LEFT JOIN spots s ON s.movie_id = m.id
    WHERE m.status = 'APPROVED'
      AND REPLACE(LOWER(m.title), ' ', '') LIKE ${pattern}
    GROUP BY m.id
    ORDER BY spot_count DESC, m.title ASC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    spotCount: Number(r.spot_count),
  }));
}
