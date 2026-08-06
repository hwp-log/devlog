'use client';
import { getAvatarInfo } from '@/lib/avatar/generate';
import { useAvatarPreview } from './AvatarContext';

interface Props {
  nickname: string;
  email: string;
  currentAvatarUrl: string | null;
}

// 0529: 왼쪽 개방 캔버스의 프로필 표시부 — 사진·이름·이메일만.
// 파일 선택 시 미리보기(AvatarContext)가 저장 전에도 즉시 반영된다.
export function AvatarDisplay({ nickname, email, currentAvatarUrl }: Props) {
  const { previewUrl } = useAvatarPreview();
  const { initial, color } = getAvatarInfo(nickname);
  const displayedUrl = previewUrl ?? currentAvatarUrl;

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      {displayedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayedUrl}
          alt="프로필 사진"
          className="w-16 h-16 sm:w-[88px] sm:h-[88px] rounded-full object-cover shrink-0"
        />
      ) : (
        <div
          className="w-16 h-16 sm:w-[88px] sm:h-[88px] rounded-full flex items-center justify-center text-white text-[23px] sm:text-3xl font-bold shrink-0"
          style={{ backgroundColor: color }}
        >
          {initial}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-lg sm:text-xl font-semibold tracking-[-0.01em] text-fg">{nickname}</p>
        <p className="text-sm text-muted">{email}</p>
      </div>
    </div>
  );
}
