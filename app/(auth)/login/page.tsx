import Link from 'next/link';
import { loginAction } from './actions';
import { LoginForm } from './LoginForm';

// 0609: 2단 글래스(brand-side + form-side) → 단일 카드 — 0608 랜딩 폐기로 소개 패널이
// 짝을 잃음. 로그인은 이미 서비스를 아는 사람이 오는 화면이라 브랜드 소개 불요.
// 카드 idiom은 mypage 정본(bg-card rounded-card border-border) 준용.
// max-w-[400px]은 로컬 리터럴 — auth 폭 토큰화는 네 화면 완성 후 공통값 판정(0609 결정).
export default function LoginPage() {
  return (
    // data-allow-landscape: 이 화면만 가로 차단 예외(globals.css body:has([data-allow-landscape])).
    // 0609: 2단 그리드는 사라졌지만 단일 폼은 가로에서도 깨지지 않아 예외 유지.
    <div
      className="w-full max-w-[400px] bg-card rounded-card border border-border px-[18px] py-[22px] sm:px-6 sm:py-[26px]"
      data-allow-landscape
    >
      <div className="text-center mb-6">
        <p className="text-2xl font-bold tracking-[-0.02em] text-fg">Dotrip</p>
        <p className="mt-1.5 text-sm text-muted break-keep">여행의 시작점을 찍다.</p>
      </div>

      <LoginForm action={loginAction} />

      <p className="mt-5 text-[13px] text-muted text-center break-keep">
        아직 계정이 없으신가요?{' '}
        <Link href="/signup" className="font-semibold text-fg hover:underline">
          회원가입
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
