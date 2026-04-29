import { isValidEmail } from '../validators';

describe('isValidEmail', () => {
  // 사용자가 아무것도 입력하지 않고 제출하는 경우 차단
  it('should return false when email is empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
  // 일반적인 정상 이메일 형식 통과
  it('should return true when email is valid', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  // 다른 정상 이메일도 통과해야 함
  it('should return true for another valid email', () => {
    expect(isValidEmail('admin@test.com')).toBe(true);
  });

  // '@' 뒤에 도메인이 없으면 무효 (현재 로직의 한계 노출)
  it('should return false when email has no domain after @', () => {
    expect(isValidEmail('user@')).toBe(false);
  });
});
