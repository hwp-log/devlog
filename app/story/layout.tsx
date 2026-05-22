import Link from 'next/link';

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <header className="sticky top-0 z-10 glass-header">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center">
          <Link href="/story" className="text-lg font-bold text-[#1A1A1A]">Dotrip</Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
