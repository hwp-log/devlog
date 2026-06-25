import { getAvatarInfo } from '@/lib/avatar/generate';

interface Props {
  nickname: string;
  avatarUrl: string | null;
}

export function AuthorAvatar({ nickname, avatarUrl }: Props) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="w-6 h-6 rounded-full object-cover shrink-0"
      />
    );
  }
  const { initial, color } = getAvatarInfo(nickname);
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
      style={{ backgroundColor: color }}
      aria-label={`${nickname} 아바타`}
    >
      {initial}
    </span>
  );
}
