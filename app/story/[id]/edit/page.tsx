import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { StoryWriteForm } from '@/app/story/new/StoryWriteForm';
import { updateStoryAction } from '../actions';

export default async function StoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await prisma.story.findUnique({ where: { id }, include: { tags: true } });
  if (!story) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== story.userId) redirect(`/story/${id}`);

  const boundAction = updateStoryAction.bind(null, story.id);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">스토리 수정</h1>
      <p className="text-sm text-slate-500 mb-6">내용을 수정하고 저장하세요</p>
      <div className="glass-outer p-8">
        <StoryWriteForm
          action={boundAction}
          initialData={{ title: story.title, content: story.content, tags: story.tags.map((t) => t.name) }}
          userId={user.id}
        />
      </div>
    </div>
  );
}
