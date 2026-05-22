import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const BRAND_TAGS = ['TRAVEL', 'PLAN', 'RECORD'] as const;

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/story');

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <div
        className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-8"
        style={{
          backgroundImage: "url('/images/auth-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
        }}
      >
        <div className="absolute inset-0 z-0" style={{ background: 'rgba(0, 0, 0, 0.4)' }} />
        <div className="relative z-10 w-full flex items-center justify-center">
          <div
            className="glass-outer grid w-full"
            style={{ maxWidth: '900px', gridTemplateColumns: '1.1fr 1fr' }}
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

              <div
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

            {/* 우측: cta-side */}
            <div className="glass-form flex flex-col justify-center" style={{ padding: '56px 48px' }}>
              <div style={{ marginBottom: '36px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#1A1A1A', marginBottom: '6px' }}>
                  가보고 싶었던 그 장면, 그 장소.
                </h2>
                <p style={{ fontSize: '13px', color: '#666' }}>
                  촬영지를 찾고, 여행을 계획하고, 기록하세요
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="/signup"
                  className="w-full bg-[#1A1A1A] text-white rounded-full py-[13px] text-sm font-semibold text-center hover:bg-[#333] transition-colors"
                >
                  회원가입
                </Link>
                <Link
                  href="/login"
                  className="w-full rounded-full py-[13px] text-sm font-semibold text-center text-[#1A1A1A] transition-colors hover:bg-black/5"
                  style={{ border: '0.5px solid rgba(0,0,0,0.2)' }}
                >
                  로그인
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
