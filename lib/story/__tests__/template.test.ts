import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { STORY_FORMS, STORY_TEMPLATE_HTML, resolveFormatInsertion } from '../template';
import { docHasUserContent } from '../empty-sections-doc';
import { Callout } from '@/app/(protected)/story/new/Callout';

// 양식 5종 — 전체 골격 해석(resolveFormatInsertion, 0359 전체 교체)과
// 교체 확인 분기 판정(docHasUserContent: 예시 원문 판정 포함) 검증.
// 0365: 기본 양식이 자유형(빈 본문)이 되어, 예시 원문 픽스처는 ④ 골격을 직접 해석해 쓴다.

const pilgrimage = STORY_FORMS.find((f) => f.key === 'pilgrimage')!;
const PILGRIMAGE_HTML = resolveFormatInsertion(pilgrimage);

describe('STORY_FORMS heading 유일성 (예시 서명 매칭 안전)', () => {
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

describe('resolveFormatInsertion — 항상 전체 골격(0359 전체 교체)', () => {
  it('전 섹션 + tail(콜아웃) + 끝 빈 문단을 반환한다', () => {
    const html = resolveFormatInsertion(pilgrimage);
    for (const s of pilgrimage.sections) expect(html).toContain(`<h2>${s.heading}</h2>`);
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain('data-callout="faq"');
    expect(html.endsWith('<p></p>')).toBe(true);
  });

  it('자유형: 빈 문자열(빈 본문·서식 지우기 겸용)', () => {
    const free = STORY_FORMS.find((f) => f.key === 'free')!;
    expect(resolveFormatInsertion(free)).toBe('');
  });

  it('STORY_TEMPLATE_HTML은 ⑤ 자유형에서 파생된 빈 본문이다(0365 — 새 글은 빈 화면 + 힌트)', () => {
    const free = STORY_FORMS.find((f) => f.key === 'free')!;
    expect(STORY_TEMPLATE_HTML).toBe(resolveFormatInsertion(free));
    expect(STORY_TEMPLATE_HTML).toBe('');
  });
});

describe('docHasUserContent — 교체 확인 분기(내용 없으면 무확인 즉시 교체)', () => {
  const schema = getSchema([StarterKit, Image, Callout]);
  const docFromHtml = (html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return PMDOMParser.fromSchema(schema).parse(el);
  };

  it('빈 골격: 내용 없음', () => {
    const doc = docFromHtml('<h2>그 장면, 그 자리</h2><p></p><h2>방문 정보</h2><p></p>');
    expect(docHasUserContent(doc)).toBe(false);
  });

  it('④ 예시 원문 그대로: 내용 없음 → 확인 건너뜀 조건', () => {
    expect(docHasUserContent(docFromHtml(PILGRIMAGE_HTML))).toBe(false);
  });

  it('한 글자만 수정: 내용 있음 → 확인 화면 조건', () => {
    const html = PILGRIMAGE_HTML.replace('출입 제한이다', '출입 제한이었다');
    expect(docHasUserContent(docFromHtml(html))).toBe(true);
  });

  it('한 섹션에만 씀: 내용 있음', () => {
    const doc = docFromHtml('<h2>그 장면, 그 자리</h2><p>좋았어요</p><h2>방문 정보</h2><p></p>');
    expect(docHasUserContent(doc)).toBe(true);
  });

  it('제목 없는 도입부 내용: 내용 있음', () => {
    const doc = docFromHtml('<p>인트로 내용</p><h2>그 장면, 그 자리</h2><p></p>');
    expect(docHasUserContent(doc)).toBe(true);
  });

  it('서식만 변경(strong 해제): 텍스트가 같으면 예시 취급 → 내용 없음', () => {
    const html = PILGRIMAGE_HTML.replace('<strong>정문 담장</strong>', '정문 담장');
    expect(docHasUserContent(docFromHtml(html))).toBe(false);
  });

  it('빈 문단 추가(공백 차이): 예시 취급 → 내용 없음', () => {
    const html = PILGRIMAGE_HTML.replace('<p>사진을', '<p></p><p>사진을');
    expect(docHasUserContent(docFromHtml(html))).toBe(false);
  });

  it('예시 섹션 일부 삭제(나머지는 원문 그대로): 내용 없음 → 무확인 교체', () => {
    // "그 장면, 그 자리" 구간 전체를 지운 상태 — 남은 구간이 전부 예시 원문이면 안 쓴 것
    const removed = PILGRIMAGE_HTML.replace(
      /<h2>그 장면, 그 자리<\/h2>.*?(?=<h2>방문 정보<\/h2>)/,
      '',
    );
    expect(docHasUserContent(docFromHtml(removed))).toBe(false);
  });

  it('예시 텍스트 그대로 + 이미지 추가: 이미지 가드로 내용 있음', () => {
    const html = PILGRIMAGE_HTML.replace(
      '<p>사진을',
      '<img src="https://example.com/x.png"><p>사진을',
    );
    expect(docHasUserContent(docFromHtml(html))).toBe(true);
  });

  it('heading 변경 + 본문 예시 그대로: 서명 조회 실패로 내용 있음(보수적 판정)', () => {
    const html = PILGRIMAGE_HTML.replace('<h2>방문 정보</h2>', '<h2>나의 방문 정보</h2>');
    expect(docHasUserContent(docFromHtml(html))).toBe(true);
  });
});
