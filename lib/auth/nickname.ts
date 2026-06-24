import { getRandomNickname } from '@woowa-babble/random-nickname';

const MAX_LEN = 20;
const MAX_TRIES = 5;

export function generateNickname(userId: string): string {
  for (let i = 0; i < MAX_TRIES; i++) {
    const n = getRandomNickname('animals');
    if (n && n.length <= MAX_LEN) return n;
  }
  return '여행자_' + userId.slice(0, 4).toUpperCase();
}
