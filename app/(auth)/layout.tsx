/**
 * 로그인/회원가입 페이지를 감싸는 공통 껍데기
 * - 화면 중앙 정렬된 카드 형태
 * - 상단에 서비스 로고 고정
 * - 본문(children)은 각 페이지가 채움
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // 전체 배경: 화면 전체 높이 확보, 연한 중립 톤으로 카드와 대비
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      {/* 카드 컨테이너: 최대 너비 제한으로 폼 가독성 확보 */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8">
        {/* 서비스 로고: 브랜드 인지 + 현재 위치 안내 */}
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-8">
          DevLog
        </h1>
        {children}
      </div>
    </div>
  );
}
