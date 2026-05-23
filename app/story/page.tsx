import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function StoryPage() {
  const stories = await prisma.story.findMany({
    include: { user: true, tags: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">Story</h1>
      {stories.length === 0 ? (
        <div className="glass-outer p-12 text-center text-slate-500">
          아직 작성된 글이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {stories.map((story) => (
            <Link key={story.id} href={`/story/${story.id}`} className="glass-outer glass-outer-interactive p-6 block cursor-pointer">
              <article>
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">{story.title}</h2>
                <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3">{story.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {story.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 shrink-0 ml-4">
                    <span>{story.user.email}</span>
                    <span className="mx-1">·</span>
                    <span>{story.createdAt.toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
