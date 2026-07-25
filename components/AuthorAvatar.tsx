import { getAvatarInfo } from '@/lib/avatar/generate';

interface Props {
  nickname: string;
  avatarUrl: string | null;
  // badge(0372, 스토리 상세 시안): 18px·surface2+border·이니셜 9px/600 — 랜덤 색 미사용.
  // 기본(미지정)은 기존 24px 랜덤 색 그대로 — plan-finder 등 기존 사용처 무영향.
  variant?: 'badge';
}

export function AuthorAvatar({ nickname, avatarUrl, variant }: Props) {
  const isBadge = variant === 'badge';
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`${isBadge ? 'w-[18px] h-[18px]' : 'w-6 h-6'} rounded-full object-cover shrink-0`}
      />
    );
  }
  const { initial, color } = getAvatarInfo(nickname);
  if (isBadge) {
    return (
      <span
        className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-semibold text-fg2 bg-surface2 border border-border shrink-0"
        aria-label={`${nickname} 아바타`}
      >
        {initial}
      </span>
    );
  }
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
