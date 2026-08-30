import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { buildThemeCss } from "@/lib/theme";
import { ThemeProvider } from "@/app/(protected)/_components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // OG·트위터 이미지의 상대 경로를 절대 URL로 해석하는 기준. 없으면 localhost 기준으로 생성됨
  // apex(dotrip.io)는 www로 리다이렉트되므로 리다이렉트 없는 최종 주소를 직접 넣는다
  metadataBase: new URL("https://www.dotrip.io"),
  title: "Dotrip | 드라마·영화 촬영지 여행 기록",
  description:
    "촬영지를 찾고, 다녀오고, 남기는 곳. 드라마와 영화 속 그 장소로 가는 길을 기록하고 공유합니다.",
};

// 0226: 노치·홈바 대응 — env(safe-area-inset-*)가 실제값을 반환하려면 viewport-fit=cover 필수(기존 부재).
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // GA4 — Vercel Production에만 NEXT_PUBLIC_GA_ID가 있어 Preview·로컬 방문은 수집 안 됨
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    // suppressHydrationWarning: next-themes가 첫 페인트 전 html의 data-theme를 수정 (1레벨만 적용)
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 디자인 토큰 발행 — 값의 정본은 lib/theme.ts (A005 §2·§3) */}
        <style id="dotrip-theme">{buildThemeCss()}</style>
        <ThemeProvider>{children}</ThemeProvider>
        {/* 0241: 모바일 가로 차단 안내 — 세로 전용 앱(PWA 아님이라 CSS 오버레이). 표시 조건은 globals.css 미디어쿼리. */}
        <div className="landscape-blocker" role="alert">
          <span className="landscape-blocker__icon" aria-hidden>📱</span>
          <p className="landscape-blocker__title">세로로 돌려주세요</p>
          <p className="landscape-blocker__sub">이 화면은 세로 모드에 최적화되어 있어요</p>
        </div>
        {/* Vercel Web Analytics — 자기 도메인 경로(/_vercel/insights)로 전송해 광고 차단기에 안 걸림. dev 모드는 수집 안 함 */}
        <Analytics />
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
