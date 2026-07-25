import { getAvatarInfo } from '@/lib/avatar/generate';

interface Props {
  nickname: string;
  avatarUrl: string | null;
  // sm(0375, 스토리 상세 메타): 18px·이니셜 9px — 색·글자 체계는 기본(getAvatarInfo 랜덤 색 +
  // 흰 이니셜)과 동일, 크기만 다름. 0372의 variant='badge'(surface2 회색 배지)는 실제 프로필과
  // 모양이 달라 폐기 — 차이가 크기뿐이라 size prop으로 재편. 미지정 = 기존 24px(사용처 무영향).
  size?: 'sm';
}

export function AuthorAvatar({ nickname, avatarUrl, size }: Props) {
  const dim = size === 'sm' ? 'w-[18px] h-[18px]' : 'w-6 h-6';
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`${dim} rounded-full object-cover shrink-0`}
      />
    );
  }
  const { initial, color } = getAvatarInfo(nickname);
  return (
    <span
      className={`${dim} ${size === 'sm' ? 'text-[9px]' : 'text-[10px]'} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
      aria-label={`${nickname} 아바타`}
    >
      {initial}
    </span>
  );
}
