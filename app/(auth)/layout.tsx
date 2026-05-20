export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
          {children}
        </div>
      </div>
    </>
  );
}
