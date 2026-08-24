import Link from 'next/link';
import { signupAction } from './actions';
import { SignupForm } from './SignupForm';

// 0610: 2단 글래스 → 단일 카드 — 0609(/login) 골격 정본 준용. 0609가 auth 배경을
// 토큰화하며 brand-side 흰 글씨가 흰 배경 위에서 안 읽히던 회귀 해소.
// 카드 폭·로고·태그라인·하단 링크 배치는 login/page.tsx와 동기 — 한쪽만 바꾸면 어긋남.
export default function SignupPage() {
  return (
    // data-allow-landscape: 가로 차단 예외 — 단일 폼은 가로에서도 깨지지 않음(0609 결정 준용)
    <div
      className="w-full max-w-[400px] bg-card rounded-card border border-border px-[18px] py-[22px] sm:px-6 sm:py-[26px]"
      data-allow-landscape
    >
      <div className="text-center mb-6">
        <p className="text-2xl font-bold tracking-[-0.02em] text-fg">Dotrip</p>
        <p className="mt-1.5 text-sm text-muted break-keep">여행의 시작점을 찍다.</p>
      </div>

      <SignupForm action={signupAction} />

      <p className="mt-5 text-[13px] text-muted text-center break-keep">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-semibold text-fg hover:underline">
          로그인
        </Link>
      </p>

      <div className="mt-5 pt-4 border-t border-hairline text-center">
        <Link href="/story" className="text-[13px] text-muted hover:text-fg2 transition-colors">
          둘러보기
        </Link>
      </div>
    </div>
  );
}
