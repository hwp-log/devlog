'use server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { searchMovies, findMovieByNormalizedTitle } from '@/lib/movie/queries';
import type { MovieSuggestion } from '@/lib/movie/queries';

export async function searchMoviesAction(query: string): Promise<MovieSuggestion[]> {
  return searchMovies(query);
}

type SubmitResult = { movie: { id: string; title: string } } | { error: string };

export async function submitMovie(title: string): Promise<SubmitResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const trimmed = title.trim();
  if (!trimmed) return { error: '작품명을 입력해주세요' };
  if (trimmed.length > 50) return { error: '작품명은 50자 이하로 입력해주세요' };

  const existing = await findMovieByNormalizedTitle(trimmed);
  if (existing) return { movie: existing };

  const created = await prisma.movie.create({
    data: { title: trimmed, status: 'PENDING' },
    select: { id: true, title: true },
  });
  return { movie: created };
}
