import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { extractFirstImage, extractTextPreview } from '@/lib/story/extract-thumbnail';

export default async function MyDotsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const stories = await prisma.story.findMany({
    where: { userId: user!.id },
    include: { tags: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">MyStory</h1>

      {stories.length === 0 ? (
        <div className="glass-outer p-12 text-center">
          <p className="text-slate-500 mb-4">아직 작성한 스토리가 없습니다.</p>
          <Link
            href="/story/new"
            className="inline-block bg-[#1A1A1A] text-white px-5 py-2 rounded-full text-sm"
          >
            첫 스토리 작성하기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((story) => {
            const thumbnail = extractFirstImage(story.content);
            const preview = extractTextPreview(story.content);
            return (
              <Link
                key={story.id}
                href={`/story/${story.id}`}
                className="glass-outer glass-outer-interactive overflow-hidden block cursor-pointer"
              >
                <article>
                  {thumbnail ? (
                    <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                      <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                      이미지 없음
                    </div>
                  )}
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">{story.title}</h2>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-2">{preview}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {story.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                        >
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-slate-400">
                      {story.createdAt.toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
