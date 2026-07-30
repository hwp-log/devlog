// 카드 pill 공용 스타일 — PlanCard·StoryCard가 공유(스타일의 단일 소스).
// 두 카드가 이 클래스를 import해 chip·좋아요에 동일 적용한다(한쪽만 바뀌는 어긋남 방지).
//
// 0449(2026-07-31): "칩은 사진 위라 테마 무관 고정"(0436·0443) → "페이지 톤과 맞춰 테마 분기"로 전환.
//   카드가 페이지 배경과 한 톤으로 읽히게 하려는 의도. 인라인 style은 테마 분기가 안 돼
//   Tailwind dark: 변형(@custom-variant dark, next-themes data-theme)으로 옮겼다.
// - 라이트: 흰 배경 0.92 + 어두운 글씨 (구 StoryCard 값)
// - 다크: 반투명 검정 0.72 + 흰 글씨 (구 PlanCard 값)
// - 그림자·inset 헤어라인: 라이트는 어두운 헤어라인, 다크는 밝은 헤어라인 + 강한 드롭섀도.
//   다크에선 0.72 검정 칩이 어두운 썸네일과 명도가 같아 칩 경계가 사라지므로(스크림은 하단만 덮음)
//   헤어라인을 밝게 뒤집어 상단 경계를 살린다.
// 완전 리터럴 유지 — Tailwind JIT는 리터럴만 스캔(CLAUDE.md §5). 값 분해·보간 금지.
export const CARD_PILL_CLASS =
  'bg-[rgba(255,255,255,0.92)] text-[#191a1c] ' +
  'shadow-[0_1px_3px_rgba(0,0,0,0.12),inset_0_0_0_0.5px_rgba(0,0,0,0.08)] ' +
  'dark:bg-[rgba(13,13,20,0.72)] dark:text-white ' +
  'dark:shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_0_0_0.5px_rgba(255,255,255,0.14)]';
