import Link from 'next/link';
import { Heart } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { extractFirstImage, extractTextPreview } from '@/lib/story/extract-thumbnail';
import { formatRelativeDate } from '@/lib/format-date';

export default async function StoryPage() {
  const stories = await prisma.story.findMany({
    include: { user: true, tags: true, _count: { select: { likes: true } } },
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stories.map((story) => {
            const thumbnail = extractFirstImage(story.content);
            const preview = extractTextPreview(story.content);
            return (
              <Link key={story.id} href={`/story/${story.id}`} className="glass-outer glass-outer-interactive overflow-hidden block cursor-pointer">
                <article>
                  {thumbnail ? (
                    <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                      <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                      <span
                        className="absolute bottom-2 right-2 backdrop-blur-sm bg-black/35 rounded-[10px] px-2 py-0.5 font-mono text-xs text-amber-300 select-none"
                        style={{ textShadow: '0 0 6px #f59e0b' }}
                      >
                        {`${story.createdAt.getFullYear()}.${story.createdAt.getMonth() + 1}.${story.createdAt.getDate()}`}
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-slate-100 flex flex-col items-center justify-center gap-1 text-slate-400 text-xs">
                      <span>이미지 없음</span>
                      <span className="font-mono text-amber-400/60">
                        {`${story.createdAt.getFullYear()}.${story.createdAt.getMonth() + 1}.${story.createdAt.getDate()}`}
                      </span>
                    </div>
                  )}
                  <div className="p-6 pb-5">
                    <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">{story.title}</h2>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-2">{preview}</p>
                    <div className="flex flex-wrap gap-2">
                      {story.tags.slice(0, 3).map((tag) => (
                        <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          #{tag.name}
                        </span>
                      ))}
                      {story.tags.length > 3 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                          +{story.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{story.user.email}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Heart
                        size={13}
                        className={story._count.likes === 0 ? 'text-slate-300' : 'fill-rose-500 text-rose-500'}
                      />
                      <span>{story._count.likes}</span>
                    </span>
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
