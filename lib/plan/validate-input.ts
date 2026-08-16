// 0405: 플랜 입력 검증 상한 단일 소스. 폼(클라이언트)·서버 액션이 동일 상수/함수를 import.
// 지금은 headcount만. 다른 필드 상한이 생기면 여기로 모은다(인라인 분산 방지).
// 0581: 날짜 하한은 date-limits.ts로 갈렸다 — 축이 다르다(값의 범위 vs 오늘 기준 시점 판정).
//   그쪽은 KST·저장값에 의존해 순수 상수/클램프가 아니다. 이유는 date-limits.ts 상단 참조.

export const HEADCOUNT_MIN = 1;
export const HEADCOUNT_MAX = 20;

// 정수 1~20으로 클램프. 비정상 입력(NaN·소수·범위 밖)은 경계값으로 수렴, 최소 MIN 보장.
export function clampHeadcount(n: number): number {
  if (!Number.isFinite(n)) return HEADCOUNT_MIN;
  const int = Math.floor(n);
  return Math.min(HEADCOUNT_MAX, Math.max(HEADCOUNT_MIN, int));
}
