import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { PRISTINE_TEXT_BY_HEADING, normalizePristineText } from './template';

// clean-empty-sections.ts(서버·jsdom, 발행 시 정리)와 "같은 구간 분할 규칙"의 ProseMirror판.
// 역할(0359): 양식 교체의 확인 분기 판정 — "사용자가 쓴 내용이 있는가" 하나만 답한다.
// 교체는 항상 전체 교체(survivor 병합 폐기)라, 내용이 있으면 확인 화면을 거치고
// 없으면(빈 본문·예시 원문 그대로) 즉시 교체한다. 모바일엔 Ctrl+Z가 없어 확인이 유일한
// 방어선 — 판정은 의심스러우면 "내용 있음"(확인 표시) 쪽으로 기운다.
// ── 발행판과의 비대칭(0355 확정 유지): 발행은 빈 섹션만 정리하고 예시 원문 그대로여도 게시.
//    구간 분할 규칙 자체를 바꿀 땐 두 파일을 함께 고칠 것.
//
// 판정 규칙: heading으로 구간 분할(도입부 = 첫 heading 앞). 어떤 구간이
//   ① heading 아닌 "내용" 블록을 갖고, ② 예시 원문이 아니면 → 사용자 내용 있음.
//   예시 원문 = 이미지 없음 ∧ 구간 텍스트가 예시 서명과 정규화 일치(공백·서식 차이 무시).
//   이미지가 있으면 무조건 내용(예시엔 이미지가 없다 — 이미지 가드). heading을 바꾼 구간은
//   서명 조회가 실패해 내용으로 남는다. heading 자신의 제목 텍스트는 "내용"으로 치지 않는다.

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

export function docHasUserContent(doc: ProseMirrorNode): boolean {
  // 톱레벨 노드를 heading 기준 구간으로 분할(clean-empty-sections.ts와 동일 순서).
  const regions: ProseMirrorNode[][] = [];
  let current: ProseMirrorNode[] = [];
  doc.forEach((node) => {
    if (node.type.name === 'heading' && current.length > 0) {
      regions.push(current);
      current = [];
    }
    current.push(node);
  });
  if (current.length > 0) regions.push(current);

  for (const region of regions) {
    const bodyBlocks = region.filter((n) => n.type.name !== 'heading');
    if (!bodyBlocks.some(nodeHasContent)) continue; // 빈 구간

    // 예시 원문 판정 — 구간 전체 텍스트(콜아웃 제목 포함: 서명도 tailHtml 텍스트를 포함해
    // 대응됨. nodeHasContent의 제목 제외와 목적이 달라 비대칭이 맞다)가 서명과 일치하면
    // 사용자 내용 아님. 도입부(제목 없는 구간)의 내용은 서명이 없어 곧장 내용으로 판정된다.
    const headingNode = region.find((n) => n.type.name === 'heading');
    const pristine =
      headingNode !== undefined &&
      !bodyBlocks.some(containsImage) &&
      normalizePristineText(bodyBlocks.map((n) => n.textContent).join('')) ===
        PRISTINE_TEXT_BY_HEADING.get(headingNode.textContent.trim());

    if (!pristine) return true;
  }
  return false;
}
