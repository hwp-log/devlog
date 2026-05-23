'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

type ActionState = { error: string } | null;

export async function updateStoryAction(storyId: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) return { error: '수정 권한이 없습니다' };

  const title = formData.get('title')?.toString().trim() ?? '';
  const content = formData.get('content')?.toString().trim() ?? '';
  const tagsRaw = formData.get('tags') as string;
  const tagNames: string[] = JSON.parse(tagsRaw || '[]');

  if (!title) return { error: '제목을 입력해주세요' };
  if (!content) return { error: '본문을 입력해주세요' };

  await prisma.story.update({
    where: { id: storyId },
    data: {
      title,
      content,
      tags: {
        set: [],
        connectOrCreate: tagNames.map((name) => ({
          where: { name },
          create: { name },
        })),
      },
    },
  });

  redirect(`/story/${storyId}`);
}

export async function deleteStoryAction(storyId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) redirect(`/story/${storyId}`);

  await prisma.story.delete({ where: { id: storyId } });

  redirect('/story');
}
