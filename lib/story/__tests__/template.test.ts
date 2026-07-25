import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { STORY_FORMS, STORY_TEMPLATE_HTML, resolveFormatInsertion } from '../template';
import { classifyDocSections } from '../empty-sections-doc';
import { Callout } from '@/app/(protected)/story/new/Callout';

// 양식 5종 예시 본문화(0355) — 삽입 해석(resolveFormatInsertion)·문서 분류(classifyDocSections의
// 예시 원문 판정 포함) 검증.

const pilgrimage = STORY_FORMS.find((f) => f.key === 'pilgrimage')!;

describe('STORY_FORMS heading 유일성 (survivor·예시 서명 매칭 안전)', () => {
  it('5양식 전체에서 섹션 heading이 중복되지 않는다', () => {
    const all = STORY_FORMS.flatMap((f) => f.sections.map((s) => s.heading));
    expect(new Set(all).size).toBe(all.length);
  });

  it('자유형은 섹션·tail이 없다(완전히 빈 본문)', () => {
    const free = STORY_FORMS.find((f) => f.key === 'free')!;
    expect(free.sections).toEqual([]);
    expect(free.tailHtml).toBe('');
  });
});

describe('resolveFormatInsertion — 삽입 HTML 해석', () => {
  it('survivor 없음: 전 섹션 + tail(hr·콜아웃) + 끝 빈 문단을 넣는다', () => {
    const html = resolveFormatInsertion(pilgrimage, new Set());
    for (const s of pilgrimage.sections) expect(html).toContain(`<h2>${s.heading}</h2>`);
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain('data-callout="faq"');
    expect(html.endsWith('<p></p>')).toBe(true);
  });

  it('중간 섹션 survivor: 그 섹션만 빼고 tail은 유지된다(마지막 섹션이 삽입되므로)', () => {
    const html = resolveFormatInsertion(pilgrimage, new Set(['그 장면, 그 자리']));
    expect(html).not.toContain('<h2>그 장면, 그 자리</h2>');
    expect(html).toContain('<h2>방문 정보</h2>');
    expect(html).toContain('data-callout="tip"');
  });

  it('마지막 섹션 survivor: tail·끝 빈 문단을 넣지 않는다(옛 콜아웃과 중복 방지)', () => {
    const html = resolveFormatInsertion(pilgrimage, new Set(['방문 정보']));
    expect(html).toContain('<h2>작품과 장소</h2>');
    expect(html).not.toContain('data-callout');
    expect(html).not.toContain('<hr>');
    expect(html.endsWith('<p></p>')).toBe(false);
  });

  it('전부 survivor: 아무것도 삽입하지 않는다', () => {
    const survivors = new Set(pilgrimage.sections.map((s) => s.heading));
    expect(resolveFormatInsertion(pilgrimage, survivors)).toBe('');
  });

  it('제목 변경: 다른 텍스트의 heading은 겹치지 않음 → 전체 삽입', () => {
    const html = resolveFormatInsertion(pilgrimage, new Set(['내가 바꾼 제목']));
    for (const s of pilgrimage.sections) expect(html).toContain(`<h2>${s.heading}</h2>`);
  });

  it('자유형: 빈 문자열(프리필 없음)', () => {
    const free = STORY_FORMS.find((f) => f.key === 'free')!;
    expect(resolveFormatInsertion(free, new Set())).toBe('');
  });

  it('STORY_TEMPLATE_HTML은 ④ 촬영지 순례형 전체 골격에서 파생된다', () => {
    expect(STORY_TEMPLATE_HTML).toBe(resolveFormatInsertion(pilgrimage, new Set()));
    expect(STORY_TEMPLATE_HTML.startsWith('<h2>작품과 장소</h2>')).toBe(true);
  });
});

describe('classifyDocSections — 빈 구간/예시 원문 판정/살아남는 섹션', () => {
  const schema = getSchema([StarterKit, Image, Callout]);
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

  it('프리필 원문 그대로: 전 구간이 빈 것 취급 → 전체 교체 경로(hasContent=false)', () => {
    const { survivingHeadings, emptyRanges, hasContent } = classifyDocSections(
      docFromHtml(STORY_TEMPLATE_HTML),
    );
    expect([...survivingHeadings]).toEqual([]);
    expect(emptyRanges.length).toBe(3); // 작품과 장소 / 그 장면, 그 자리 / 방문 정보(+tail)
    expect(hasContent).toBe(false);
  });

  it('한 글자만 수정: 그 구간은 사용자 내용으로 보존된다', () => {
    const html = STORY_TEMPLATE_HTML.replace('출입 제한이다', '출입 제한이었다');
    const { survivingHeadings, hasContent } = classifyDocSections(docFromHtml(html));
    expect([...survivingHeadings]).toEqual(['방문 정보']);
    expect(hasContent).toBe(true);
  });

  it('서식만 변경(strong 해제): 텍스트가 같으면 예시 원문 취급', () => {
    const html = STORY_TEMPLATE_HTML.replace('<strong>정문 담장</strong>', '정문 담장');
    const { survivingHeadings, hasContent } = classifyDocSections(docFromHtml(html));
    expect([...survivingHeadings]).toEqual([]);
    expect(hasContent).toBe(false);
  });

  it('빈 문단 추가(공백 차이): 예시 원문 취급', () => {
    const html = STORY_TEMPLATE_HTML.replace('<p>사진을', '<p></p><p>사진을');
    const { hasContent } = classifyDocSections(docFromHtml(html));
    expect(hasContent).toBe(false);
  });

  it('예시 텍스트 그대로 + 이미지 추가: 이미지 가드로 보존된다', () => {
    const html = STORY_TEMPLATE_HTML.replace(
      '<p>사진을',
      '<img src="https://example.com/x.png"><p>사진을',
    );
    const { survivingHeadings, hasContent } = classifyDocSections(docFromHtml(html));
    expect([...survivingHeadings]).toEqual(['방문 정보']);
    expect(hasContent).toBe(true);
  });

  it('heading 변경 + 본문 예시 그대로: 서명 조회 실패로 보존된다(사용자 개입 흔적)', () => {
    const html = STORY_TEMPLATE_HTML.replace('<h2>방문 정보</h2>', '<h2>나의 방문 정보</h2>');
    const { survivingHeadings } = classifyDocSections(docFromHtml(html));
    expect([...survivingHeadings]).toEqual(['나의 방문 정보']);
  });
});
