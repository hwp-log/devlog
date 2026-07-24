import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { STORY_FORMS, sectionsToInsert, STORY_ALL_SECTIONS } from '../template';
import { classifyDocSections } from '../empty-sections-doc';

// 양식 5종 재설계 — 교체 판정(sectionsToInsert)·문서 분류(classifyDocSections)·placeholder 매핑 검증.

const pilgrimage = STORY_FORMS.find((f) => f.key === 'pilgrimage')!;

describe('STORY_FORMS heading 유일성 (survivor 매칭 안전)', () => {
  it('5양식 전체에서 섹션 heading이 중복되지 않는다', () => {
    const all = STORY_FORMS.flatMap((f) => f.sections.map((s) => s.heading));
    expect(new Set(all).size).toBe(all.length);
  });

  it('자유형은 섹션이 없다', () => {
    expect(STORY_FORMS.find((f) => f.key === 'free')!.sections).toEqual([]);
  });
});

describe('sectionsToInsert — 살아남는 섹션 제외', () => {
  it('survivor 없음: 양식 섹션을 모두 삽입한다', () => {
    const result = sectionsToInsert(pilgrimage.sections, new Set());
    expect(result.map((s) => s.heading)).toEqual(pilgrimage.sections.map((s) => s.heading));
  });

  it('일부 겹침: 겹치는 섹션만 제외한다', () => {
    const survivors = new Set(['그 장면, 그 자리']);
    const result = sectionsToInsert(pilgrimage.sections, survivors);
    expect(result.map((s) => s.heading)).toEqual(['작품과 장소', '방문 정보', '같이 갈 만한 곳']);
  });

  it('전부 겹침: 아무것도 삽입하지 않는다', () => {
    const survivors = new Set(pilgrimage.sections.map((s) => s.heading));
    expect(sectionsToInsert(pilgrimage.sections, survivors)).toEqual([]);
  });

  it('제목 변경: 다른 텍스트의 heading은 겹치지 않음 → 전체 삽입', () => {
    const survivors = new Set(['내가 바꾼 제목']);
    const result = sectionsToInsert(pilgrimage.sections, survivors);
    expect(result.map((s) => s.heading)).toEqual(pilgrimage.sections.map((s) => s.heading));
  });
});

describe('classifyDocSections — 빈 구간/살아남는 섹션/내용 유무', () => {
  const schema = getSchema([StarterKit]);
  const docFromHtml = (html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return PMDOMParser.fromSchema(schema).parse(el);
  };

  it('빈 골격: 모든 섹션이 빈 구간, 살아남는 heading 없음, 내용 없음', () => {
    const doc = docFromHtml('<h2>그 장면, 그 자리</h2><p></p><h2>방문 정보</h2><p></p>');
    const { survivingHeadings, emptyRanges, hasContent } = classifyDocSections(doc);
    expect([...survivingHeadings]).toEqual([]);
    expect(emptyRanges.length).toBe(2);
    expect(hasContent).toBe(false);
  });

  it('한 섹션만 채움: 그 heading만 살아남고 나머지는 빈 구간, 내용 있음', () => {
    const doc = docFromHtml('<h2>그 장면, 그 자리</h2><p>좋았어요</p><h2>방문 정보</h2><p></p>');
    const { survivingHeadings, emptyRanges, hasContent } = classifyDocSections(doc);
    expect([...survivingHeadings]).toEqual(['그 장면, 그 자리']);
    expect(emptyRanges.length).toBe(1);
    expect(hasContent).toBe(true);
  });

  it('도입부 내용: 제목 없는 내용은 hasContent=true지만 survivingHeadings엔 없음', () => {
    const doc = docFromHtml('<p>인트로 내용</p><h2>그 장면, 그 자리</h2><p></p>');
    const { survivingHeadings, emptyRanges, hasContent } = classifyDocSections(doc);
    expect([...survivingHeadings]).toEqual([]);
    expect(emptyRanges.length).toBe(1);
    expect(hasContent).toBe(true); // 도입부 내용 → setContent 전체 교체 금지 근거
  });
});

describe('placeholder 매핑 — 5양식 전체 커버', () => {
  it('STORY_ALL_SECTIONS는 승격된 첫 섹션·코스형 섹션을 모두 포함(누락 방지)', () => {
    const headings = STORY_ALL_SECTIONS.map((s) => s.heading);
    expect(headings).toContain('작품과 장소'); // 순례형 승격 첫 섹션(옛 도입부)
    expect(headings).toContain('1일차'); // 일차별 코스형
    expect(headings).toContain('그 장면, 그 자리'); // 촬영지 순례형
  });
});
