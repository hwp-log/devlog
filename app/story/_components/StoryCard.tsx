import Link from 'next/link';
import { Heart } from 'lucide-react';
import { AuthorAvatar } from '@/components/AuthorAvatar';

interface StoryCardProps {
  id: string;
  thumbnail: string | null;
  title: string;
  preview: string;
  createdAt: Date;
  tags: { id: string; name: string }[];
  likeCount: number;
  isLiked: boolean;
  authorNickname?: string;
  authorAvatarUrl?: string | null;
}

export function StoryCard({ id, thumbnail, title, preview, createdAt, tags, likeCount, isLiked, authorNickname, authorAvatarUrl }: StoryCardProps) {
  const dateStr = `${createdAt.getFullYear()}.${createdAt.getMonth() + 1}.${createdAt.getDate()}`;

  return (
    <Link href={`/story/${id}`} className="bg-bg border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden block cursor-pointer">
      <article>
        {thumbnail ? (
          <div className="relative aspect-[16/9] overflow-hidden bg-surface2">
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
            <span className="absolute bottom-2 right-2 backdrop-blur-sm bg-black/55 rounded-[10px] px-2 py-0.5 font-mono text-xs text-white select-none">
              {dateStr}
            </span>
          </div>
        ) : (
          <div className="aspect-[16/9] bg-surface2 flex flex-col items-center justify-center gap-1 text-muted text-xs">
            <span>이미지 없음</span>
            <span className="font-mono text-muted">{dateStr}</span>
          </div>
        )}
        <div className="p-6 pb-5">
          <h2 className="text-lg font-semibold text-fg mb-2">{title}</h2>
          <p className="text-fg2 text-sm leading-relaxed mb-4 line-clamp-2">{preview}</p>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-card text-fg2">
                #{tag.name}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-card text-muted">
                +{tags.length - 3}
              </span>
            )}
          </div>
        </div>
        <div className="border-t border-border px-6 py-3 flex items-center justify-between">
          {authorNickname ? (
            <div className="flex items-center gap-2 min-w-0">
              <AuthorAvatar nickname={authorNickname} avatarUrl={authorAvatarUrl ?? null} />
              <span className="text-xs text-fg2 truncate">{authorNickname}</span>
            </div>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 text-xs text-muted">
            <Heart
              size={13}
              className={isLiked ? 'fill-heart-active text-heart-active' : 'text-muted'}
            />
            <span>{likeCount}</span>
          </span>
        </div>
      </article>
    </Link>
  );
}
