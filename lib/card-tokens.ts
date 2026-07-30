// 카드 pill 공용 토큰 — PlanCard·StoryCard가 공유(값의 단일 소스).
// 반투명 검정: 사용자 업로드 사진의 밝기를 예측할 수 없어 흰 계열보다 안정적.
// theme.ts CSS 변수와 달리 인라인 style로 직접 소비돼 여기 리터럴로 둔다(theme 토큰 예외 허용, 0406).
// 한쪽만 바뀌는 어긋남을 막으려 두 카드가 이 상수를 import해 공유한다.
export const CARD_PILL_BG = 'rgba(13,13,20,0.72)';
