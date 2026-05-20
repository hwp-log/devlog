import Link from 'next/link';
import { signupAction } from './actions';
import { SignupForm } from './SignupForm';

const BRAND_TAGS = ['TRAVEL', 'PLAN', 'RECORD'] as const;

export default function SignupPage() {
  return (
    <div
      className="glass-outer grid w-full"
      style={{ maxWidth: '900px', gridTemplateColumns: '1.1fr 1fr' }}
    >
      {/* 좌측: brand-side (로그인과 동일) */}
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
          여행에 점을 찍다.
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '36px',
          }}
        >
          旅に点を打つ。
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
          <span
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.65)',
              marginTop: '8px',
              display: 'inline-block',
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
            회원가입
          </h2>
          <p style={{ fontSize: '13px', color: '#666' }}>
            첫 점을 찍어보세요
          </p>
        </div>

        <SignupForm action={signupAction} />

        <p style={{ fontSize: '13px', color: '#666', textAlign: 'center', marginTop: '20px' }}>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" style={{ color: '#1A1A1A', fontWeight: 600 }}>
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
