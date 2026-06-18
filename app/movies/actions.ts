'use server';
import { searchMovies } from '@/lib/movie/queries';
import type { MovieSuggestion } from '@/lib/movie/queries';

export async function searchMoviesAction(query: string): Promise<MovieSuggestion[]> {
  return searchMovies(query);
}
