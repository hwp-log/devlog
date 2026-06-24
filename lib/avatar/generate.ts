const PALETTE = [
  '#0EA5E9', '#14B8A6', '#6366F1', '#F97362',
  '#F5A623', '#EC8FB0', '#34D399', '#A78BFA',
] as const;

export function getAvatarInfo(nickname: string): { initial: string; color: string } {
  let sum = 0;
  for (let i = 0; i < nickname.length; i++) sum += nickname.charCodeAt(i);
  return {
    initial: nickname[0] ?? '?',
    color: PALETTE[sum % PALETTE.length],
  };
}
