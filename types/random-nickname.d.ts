declare module '@woowa-babble/random-nickname' {
  export function getRandomNickname(
    type: 'animals' | 'characters' | 'heros' | 'monsters'
  ): string | undefined;
}
