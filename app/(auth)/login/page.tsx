import Link from 'next/link';
import { loginAction } from './actions';
import { LoginForm } from './LoginForm';

const BRAND_TAGS = ['TRAVEL', 'PLAN', 'RECORD'] as const;

export default function LoginPage() {
  return (
    // 0394: data-allow-landscape = 이 화면만 가로 차단 예외(globals.css body:has([data-allow-landscape]))
    // 0607: 컬럼 정의를 인라인 style → 클래스로 — 인라인엔 미디어쿼리를 걸 수 없어
    //   모바일에서 2열이 고정돼 폼이 오른쪽으로 잘렸다(glass-outer overflow hidden이라
    //   스크롤 도달도 불가, 0606 실측). md(768) 미만 1열 스택. 기준은 SpotMap MOBILE_MQ(767)와
    //   동일 계열 — 640~767 2열은 컬럼 콘텐츠 폭이 ~200px라 폼이 답답하다.
    <div
      className="glass-outer grid w-full grid-cols-1 md:grid-cols-[1.1fr_1fr]"
      data-allow-landscape
      style={{ maxWidth: '900px' }}
    >
      {/* 좌측: brand-side */}
      <div style={{ padding: '56px 48px', color: '#FFFFFF' }}>
        <div className="flex gap-2" style={{ marginBottom: '32px' }}>
          {BRAND_TAGS.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                padding: '4px 10px',
                borderRadius: '100px',
                background: 'rgba(255,255,255,0.2)',
                border: '0.5px solid rgba(255,255,255,0.35)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div
          style={{
            fontSize: '56px',
            fontWeight: 600,
            letterSpacing: '-2px',
            lineHeight: 1,
            marginBottom: '10px',
            textShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          Dotrip
        </div>

        <div
          style={{
            fontSize: '20px',
            fontWeight: 500,
            marginBottom: '4px',
            textShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}
        >
          여행의 시작점을 찍다.
        </div>

        {/* 0607: 좁은 폭은 일어 숨김 — 세로가 길어지면 폼이 더 밀린다(숨기면 이 div의
            mb 36도 함께 사라져 본문과 4px로 붙는다 — 폐기 예정 화면이라 수용). */}
        <div
          className="max-md:hidden"
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '36px',
          }}
        >
          旅の始まりに点を打つ。
        </div>

        <div
          style={{
            fontSize: '14px',
            lineHeight: 1.85,
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          영화나 드라마에서 봤던 그 장면, 그 장소.<br />
          나만의 점을 찍어보자.<br />
          {/* 0607: display를 인라인에서 클래스로 — 인라인 display가 남아 있으면
              특이도에서 이겨 max-md:hidden이 안 먹는다(0462 계열: 반응형 숨김은 max-* 변형). */}
          <span
            className="inline-block max-md:hidden"
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.65)',
              marginTop: '8px',
            }}
          >
            映画やドラマで見たあのシーン、あの場所。<br />
            自分だけの点を打ってみよう。
          </span>
        </div>
      </div>

      {/* 우측: form-side */}
      <div className="glass-form flex flex-col justify-center" style={{ padding: '56px 48px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#1A1A1A', marginBottom: '6px' }}>
            Sign In
          </h2>
          <p style={{ fontSize: '13px', color: '#666' }}>
            Dotrip에 오신 것을 환영합니다
          </p>
        </div>

        <LoginForm action={loginAction} />

        <div className="flex items-center gap-3" style={{ margin: '20px 0' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'rgba(0,0,0,0.12)' }} />
          <span style={{ fontSize: '12px', color: '#999' }}>또는</span>
          <div style={{ flex: 1, height: '0.5px', background: 'rgba(0,0,0,0.12)' }} />
        </div>

        <p style={{ fontSize: '13px', color: '#666', textAlign: 'center' }}>
          아직 계정이 없으신가요?{' '}
          <Link href="/signup" style={{ color: '#1A1A1A', fontWeight: 600 }}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
