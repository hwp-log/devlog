import Link from 'next/link';
import Image from 'next/image';
import { Heart, MapPin } from 'lucide-react';
import { formatStoryCardDate } from '@/lib/format-date';

export interface StoryCardProps {
  id: string;
  thumbnail: string | null;
  title: string;
  createdAt: Date;
  likeCount: number;
  work?: string | null;
  location?: string | null;
}

export function StoryCard({ id, thumbnail, title, createdAt, likeCount, work, location }: StoryCardProps) {
  return (
    <Link href={`/story/${id}`} className="group block cursor-pointer">
      <div className="relative aspect-[4/3] rounded-[12px] overflow-hidden bg-surface2">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 17vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">이미지 없음</div>
        )}
        {work && (
          <span className="absolute top-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-xs font-medium shadow-sm bg-bg dark:bg-surface2 text-fg">
            {work}
          </span>
        )}
      </div>
      <h2 className="mt-2 text-xs font-medium text-fg break-keep line-clamp-2 tracking-[-0.02em]">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{formatStoryCardDate(createdAt)}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-fg2">
        {location && (
          <span className="flex items-center gap-0.5 min-w-0">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{location}</span>
          </span>
        )}
        {location && <span className="text-border" aria-hidden>·</span>}
        <span className="flex items-center gap-0.5 shrink-0">
          <Heart size={12} />
          <span>{likeCount}</span>
        </span>
      </div>
    </Link>
  );
}
