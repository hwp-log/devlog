/**
 * 이메일 형식 검증 함수
 * @ 앞뒤로 문자가 있는지 검증
 */
export function isValidEmail(email: string): boolean {
  const [local, domain] = email.split('@');
  return Boolean(local && domain);
}
