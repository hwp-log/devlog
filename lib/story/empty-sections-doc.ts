import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { PRISTINE_TEXT_BY_HEADING, normalizePristineText } from './template';

// clean-empty-sections.ts(서버·jsdom, 발행 시 정리)와 "같은 구간 분할 규칙"의 ProseMirror판.
// 여기(편집 화면)는 양식 교체 때 살아남는 섹션 판정 + 빈 구간 삭제 위치 계산에 쓴다.
// ── 두 파일은 짝이되, 0355부터 판정 폭은 의도적으로 다르다(비대칭 확정):
//    · 교체(여기) = 빈 구간에 더해 "예시 원문 그대로인 구간"도 빈 것으로 취급 —
//      프리필이 실제 텍스트가 되면서(브런치 방식) 이 확장이 없으면 교체 시 아무것도
//      안 걷히고 새 양식이 덧붙는 중복 누적이 재발한다.
//    · 발행(clean-empty-sections) = 빈 구간만 — 예시 원문 그대로여도 그대로 게시(사용자 확정).
//    구간 분할 규칙 자체를 바꿀 땐 여전히 양쪽을 함께 고칠 것.
//
// 규칙: heading으로 구간 분할(도입부 = 첫 heading 앞). 구간에 heading 아닌 "내용" 블록이
//       하나도 없으면 빈 구간. 내용이 있어도 구간 텍스트가 예시 원문 서명
//       (PRISTINE_TEXT_BY_HEADING[heading 텍스트])과 정규화 일치하면 빈 구간으로 취급한다.
//       단 이미지가 있으면 텍스트가 예시와 같아도 무조건 보존(예시엔 이미지가 없다 — 이미지 가드).
//       heading 자신의 제목 텍스트는 "내용"으로 치지 않는다.

// 노드가 이미지를 품는가 — 이미지 노드 자체 포함.
function containsImage(node: ProseMirrorNode): boolean {
  if (node.type.name === 'image') return true;
  let hasImage = false;
  node.descendants((child) => {
    if (child.type.name === 'image') hasImage = true;
    return !hasImage; // 찾으면 더 내려가지 않음
  });
  return hasImage;
}

// 노드가 "내용"인가 — 공백 아닌 텍스트 / 이미지 포함(clean-empty의 img 규칙과 대응).
// 콜아웃은 첫 문단(제목)을 내용으로 치지 않음 — clean-empty-sections.ts의 div[data-callout] 규칙과 짝.
function nodeHasContent(node: ProseMirrorNode): boolean {
  if (node.type.name === 'callout') {
    let has = false;
    node.forEach((child, _offset, i) => {
      if (i > 0 && child.textContent.trim().length > 0) has = true;
    });
    return has;
  }
  if (node.textContent.trim().length > 0) return true;
  return containsImage(node);
}

export interface DocSectionInfo {
  survivingHeadings: Set<string>; // 사용자 내용이 있어 살아남는 구간의 heading 텍스트
  emptyRanges: { from: number; to: number }[]; // 빈 구간(예시 원문 그대로 포함)의 삭제 위치
  // 본문에 사용자 내용이 하나라도 있는가(제목 없는 도입부 내용 포함) — 양식 교체 시
  // "전체 교체 가능"(비파괴) 판정용. 예시 원문 그대로만 있는 문서는 false(전체 교체 경로).
  // survivingHeadings.size로는 제목 없는 도입부 내용을 못 잡아 별도 노출.
  hasContent: boolean;
}

export function classifyDocSections(doc: ProseMirrorNode): DocSectionInfo {
  type Block = { node: ProseMirrorNode; from: number; to: number };

  // 톱레벨 노드를 heading 기준 구간으로 분할(clean-empty-sections.ts와 동일 순서).
  const regions: Block[][] = [];
  let current: Block[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === 'heading' && current.length > 0) {
      regions.push(current);
      current = [];
    }
    current.push({ node, from: offset, to: offset + node.nodeSize });
  });
  if (current.length > 0) regions.push(current);

  const survivingHeadings = new Set<string>();
  const emptyRanges: { from: number; to: number }[] = [];
  let hasContent = false;

  for (const region of regions) {
    const bodyBlocks = region.filter((b) => b.node.type.name !== 'heading');
    const hasBody = bodyBlocks.some((b) => nodeHasContent(b.node));

    // 예시 원문 판정(0355) — 구간 전체 텍스트(콜아웃 제목 포함: 서명도 tailHtml 텍스트를 포함해
    // 대응됨. nodeHasContent의 제목 제외와 목적이 달라 비대칭이 맞다)가 heading의 서명과 일치하면
    // 빈 것으로 취급. 이미지가 있으면 건너뛰고 보존(이미지 가드). heading을 바꾼 구간은
    // 서명 조회가 실패해 기존 규칙(내용 있으면 보존)으로 남는다.
    const headingBlock = region.find((b) => b.node.type.name === 'heading');
    const pristine =
      hasBody &&
      headingBlock !== undefined &&
      !bodyBlocks.some((b) => containsImage(b.node)) &&
      normalizePristineText(bodyBlocks.map((b) => b.node.textContent).join('')) ===
        PRISTINE_TEXT_BY_HEADING.get(headingBlock.node.textContent.trim());

    if (hasBody && !pristine) {
      hasContent = true; // 제목 없는 도입부 내용도 여기서 잡힘(survivingHeadings엔 안 들어감)
      for (const b of region) {
        if (b.node.type.name === 'heading') survivingHeadings.add(b.node.textContent.trim());
      }
    } else {
      emptyRanges.push({ from: region[0].from, to: region[region.length - 1].to });
    }
  }

  return { survivingHeadings, emptyRanges, hasContent };
}
