// 0609: 랜딩 페어 디자인(사진 배경 + 스크림 + Pretendard CDN) 제거 — 0608 랜딩 폐기로
// 짝을 잃어 서비스 토큰 디자인으로 전환. 배경은 body 기본(--bg-deep)에 위임,
// 폰트도 body 기본으로 — 나머지 화면과 동일(다크·라이트 토큰 자동 대응).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      {children}
    </div>
  );
}
