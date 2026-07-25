import { JSDOM } from 'jsdom';

// 발행 시 내용 없는 섹션 정리 (createStoryAction·updateStoryAction 전용, 서버).
// 목표: 사용자가 채운 내용은 절대 건드리지 않는다 — 내용 블록이 하나라도 있는 구간은 전체 보존.
// 정확성 우선으로 문자열 조작 대신 DOM(jsdom) 파싱 사용 — 중첩(blockquote>p) 경계가
// 조용히 깨지는 위험을 제거. jsdom은 서버 액션에서만 임포트되어 클라 번들에 포함되지 않는다.
//
// 0355 비대칭 확정: 교체 판정(empty-sections-doc.ts)은 "예시 원문 그대로인 구간 = 빈 것" 규칙이
// 추가로 있지만, 발행(여기)은 빈 섹션만 정리한다 — 예시 원문 그대로인 섹션도 그대로 게시(사용자 확정).
// 구간 분할 규칙 자체를 바꿀 땐 두 파일을 함께 고칠 것.

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

// 내용 있음 판정: 이미지/미디어 보유 or 공백 아닌 텍스트(&nbsp; 포함).
function hasContent(el: Element): boolean {
  if (el.tagName === 'IMG') return true; // 톱레벨 이미지 노드 자체
  if (el.querySelector('img')) return true; // 이미지를 품은 블록(figure 등)
  const text = (el.textContent ?? '').trim(); // trim은  (&nbsp;)도 공백으로 제거
  return text.length > 0;
}

export function cleanEmptySections(html: string): string {
  if (!html) return html;

  try {
    const { document } = new JSDOM(html).window;

    // 빈 콜아웃 제거 — 첫 문단(제목)은 내용으로 치지 않음(heading 규칙과 동일 철학,
    // empty-sections-doc.ts nodeHasContent의 callout 분기와 짝). 구간 분할 "전"이어야
    // 제목만 남은 콜아웃 텍스트가 소속 구간(hr 뒤 배치라 마지막 구간)을 살리는 오판이 없다.
    for (const co of Array.from(document.querySelectorAll('div[data-callout]'))) {
      const rest = Array.from(co.children).slice(1);
      if (!rest.some(hasContent)) co.remove();
    }

    const blocks = Array.from(document.body.children);

    // heading 기준 구간 분할. 구간 0 = 첫 heading 앞 도입부(제목 없음).
    // 이후 각 구간은 heading 1개 + 다음 heading 전까지의 블록. 경계는 h2·h3 등 아무 heading.
    const regions: Element[][] = [];
    let current: Element[] = [];
    for (const el of blocks) {
      if (HEADING_TAGS.has(el.tagName) && current.length > 0) {
        regions.push(current);
        current = [];
      }
      current.push(el);
    }
    if (current.length > 0) regions.push(current);

    // 구간에 heading 아닌 내용 블록이 하나도 없으면 그 구간 전체(heading + 빈 문단) 제거.
    // heading 자신의 제목 텍스트는 "내용"으로 치지 않음 → 제목만 남은 섹션이 제거 대상.
    // 제목 텍스트가 아닌 구조로 판정하므로 사용자가 H2 제목을 바꿔도 동일 적용된다.
    for (const region of regions) {
      const hasBody = region.some((el) => !HEADING_TAGS.has(el.tagName) && hasContent(el));
      if (!hasBody) {
        for (const el of region) el.remove();
      }
    }

    return document.body.innerHTML;
  } catch {
    // 파싱/직렬화 실패 시 원본 그대로 반환 — 정리 실패가 본문 손실로 이어지지 않게(안전 우선).
    return html;
  }
}
