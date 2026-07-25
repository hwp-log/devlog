import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// clean-empty-sections.ts(서버·jsdom, 발행 시 정리)와 "동일한 구간 규칙"의 ProseMirror판.
// 여기(편집 화면)는 양식 교체 때 살아남는 섹션 판정 + 빈 구간 삭제 위치 계산에 쓴다.
// ── 두 파일은 짝이다: 한쪽 규칙만 바꾸면 발행(서버) ↔ 양식 교체(편집) 동작이 어긋난다.
//
// 규칙: heading으로 구간 분할(도입부 = 첫 heading 앞). 구간에 heading 아닌 "내용" 블록이
//       하나도 없으면 그 구간 전체(heading + 빈 문단)를 빈 구간(삭제 대상)으로 본다.
//       heading 자신의 제목 텍스트는 "내용"으로 치지 않는다.

// 노드가 "내용"인가 — 이미지 노드 자체 / 공백 아닌 텍스트 / 이미지 포함(clean-empty의 img 규칙과 대응).
// 콜아웃은 첫 문단(제목)을 내용으로 치지 않음 — clean-empty-sections.ts의 div[data-callout] 규칙과 짝.
function nodeHasContent(node: ProseMirrorNode): boolean {
  if (node.type.name === 'callout') {
    let has = false;
    node.forEach((child, _offset, i) => {
      if (i > 0 && child.textContent.trim().length > 0) has = true;
    });
    return has;
  }
  if (node.type.name === 'image') return true;
  if (node.textContent.trim().length > 0) return true;
  let hasImage = false;
  node.descendants((child) => {
    if (child.type.name === 'image') hasImage = true;
    return !hasImage; // 찾으면 더 내려가지 않음
  });
  return hasImage;
}

export interface DocSectionInfo {
  survivingHeadings: Set<string>; // 내용이 있어 살아남는 구간의 heading 텍스트
  emptyRanges: { from: number; to: number }[]; // 내용 없는 구간의 삭제 위치(도입부 빈 문단 포함)
  // 본문에 내용이 하나라도 있는가(제목 없는 도입부 내용 포함) — 양식 교체 시 "전체 교체 가능"(비파괴) 판정용.
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
    const hasBody = region.some(
      (b) => b.node.type.name !== 'heading' && nodeHasContent(b.node),
    );
    if (hasBody) {
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
