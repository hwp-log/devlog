/**
 * jsdom 라이브러리는 TextEncoder 전역을 요구하는데 jest-environment-jsdom엔 없다.
 * 이 함수는 자체 JSDOM 인스턴스를 만들므로 node 환경에서 실행(TextEncoder 기본 제공).
 * @jest-environment node
 */
import { cleanEmptySections } from '../clean-empty-sections';
import { extractFirstImage } from '../extract-thumbnail';

// 발행 시 내용 없는 섹션 정리 — 사용자가 채운 내용은 절대 건드리지 않는다.
// 판정은 제목 텍스트가 아니라 구조(heading 다음 내용 블록 유무)로.
describe('cleanEmptySections — 빈 섹션 정리표', () => {
  it('도입부: 첫 heading 앞의 빈 문단을 제거한다', () => {
    const html = '<p></p><h2>분위기</h2><p>좋았어요</p>';
    expect(cleanEmptySections(html)).toBe('<h2>분위기</h2><p>좋았어요</p>');
  });

  it('빈 섹션: 내용 없는 H2와 딸린 빈 문단을 제거한다', () => {
    // 프리필 골격에서 분위기만 채운 상태
    const html =
      '<p></p><h2>분위기</h2><p>좋았어요</p><h2>촬영지 정보</h2><p></p><h2>근처 볼거리</h2><p></p>';
    expect(cleanEmptySections(html)).toBe('<h2>분위기</h2><p>좋았어요</p>');
  });

  it('보존: 모든 섹션에 내용이 있으면 원본을 그대로 둔다', () => {
    const html = '<h2>분위기</h2><p>a</p><h2>촬영지 정보</h2><p>b</p>';
    expect(cleanEmptySections(html)).toBe(html);
  });

  it('제목 변경: 사용자가 H2 제목을 바꿔도 내용 없으면 제거한다', () => {
    // 프리필 제목("분위기")이 아닌 "첫인상"으로 바뀌었어도 구조로 판정
    const html = '<h2>첫인상</h2><p></p><h2>본론</h2><p>내용</p>';
    expect(cleanEmptySections(html)).toBe('<h2>본론</h2><p>내용</p>');
  });

  it('이미지 보존: 텍스트 없이 이미지만 있는 섹션은 유지하고 썸네일이 살아있다', () => {
    const html = '<h2>사진</h2><img src="https://x.supabase.co/y.png">';
    const cleaned = cleanEmptySections(html);
    expect(cleaned).toBe(html);
    // 정리 후에도 첫 <img> 파싱(썸네일)이 깨지지 않음
    expect(extractFirstImage(cleaned)).toBe('https://x.supabase.co/y.png');
  });

  it('전체 빈: 모든 섹션이 비면 빈 문자열이 되어 빈값 체크에 걸린다', () => {
    // 프리필 골격을 한 글자도 안 채우고 발행한 경우
    const html =
      '<p></p><h2>분위기</h2><p></p><h2>촬영지 정보</h2><p></p><h2>근처 볼거리</h2><p></p>';
    expect(cleanEmptySections(html)).toBe('');
  });
});
