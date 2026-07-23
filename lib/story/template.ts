// 새 글 본문 프리필 골격 (StoryWriteForm 새 글 분기 전용)
// 저장 형식이 HTML 문자열이므로 프리필도 HTML로 둔다.
// 섹션 배열을 단일 소스로 두고 HTML 골격과 placeholder 질문을 함께 파생 —
// 제목 문자열이 두 곳에 흩어져 한쪽만 바뀌면 placeholder 매칭이 조용히 끊기는
// 무음 실패를 막기 위함.

export const STORY_TEMPLATE_SECTIONS = [
  { heading: '분위기', prompt: '어떤 분위기였나요?' },
  { heading: '촬영지 정보', prompt: '가는 길과 현장은 어땠나요?' },
  { heading: '근처 볼거리', prompt: '근처에 뭐가 있나요?' },
] as const;

// 도입부 빈 문단(제목 없음) + (H2 + 빈 문단) × 3
export const STORY_TEMPLATE_HTML =
  '<p></p>' +
  STORY_TEMPLATE_SECTIONS.map((s) => `<h2>${s.heading}</h2><p></p>`).join('');
