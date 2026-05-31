import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { DeleteButton } from './DeleteButton';
import SpotMap from '@/components/SpotMapWrapper';
import { MapPin } from 'lucide-react';

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const story = await prisma.story.findUnique({
    where: { id },
    include: { user: true, tags: true, spots: { orderBy: { order: 'asc' } } },
  });
  if (!story) notFound();

  const isOwner = currentUser?.id === story.userId;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="glass-outer p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold text-[#1A1A1A] leading-tight">{story.title}</h1>
            {isOwner && (
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/story/${story.id}/edit`}
                  className="px-4 py-1.5 rounded-full text-sm bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors"
                >
                  수정
                </Link>
                <DeleteButton storyId={story.id} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <span>{story.user.email}</span>
            <span>·</span>
            <span>{story.createdAt.toLocaleDateString('ko-KR')}</span>
          </div>
          <div
            className="tiptap-content text-base text-slate-800 leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: story.content }}
          />
          {story.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-6">
              {story.tags.map((tag) => (
                <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
          {story.spots.length > 0 && (
            <div className="border-t border-black/10 pt-6 mt-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A] mb-4">
                <MapPin size={16} />
                여행동선
              </h2>
              <SpotMap spots={story.spots} readOnly />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <Link href="/story" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
          ← 목록으로
        </Link>
      </div>
    </div>
  );
}
