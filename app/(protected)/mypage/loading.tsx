// 0539: MyPage 진입 로딩 — 서버 조회(프로필 + count 3종 + 최근 활동, Promise.all) 동안
//   모바일 탭 후 무피드백 해소용 route-level fallback (0491 스토리 작성·수정 방식 준용).
// 0541: "틀 실물 + 데이터 자리만 shimmer"(0539) 실화면 기각 → **골격 전체 shimmer**로 재작성
//   ("전체가 로딩 화면으로 보여야 하는데 뼈대가 선행 표시된 게 이상하다", CLAUDE.md §11).
//   섹션 제목·라벨·버튼·폼 필드 전부 회색 블록. 구조선(2px 실선·hairline·카드 테두리)만 실색.
// 구조 클래스는 page.tsx 및 각 컴포넌트의 짝 블록 리터럴 준용(0491 C-4) —
//   **한쪽만 바꾸면 스켈레톤→실콘텐츠 전환 시 시프트가 생긴다** (각 블록 주석에 짝 명시).
//   바는 실물 줄높이 박스 안에 배치 — 유틸(text-lg 등)은 lh 내장, arbitrary(text-[20px])는
//   lh 상속(1.5)이라 산식이 다름(0539 실측).
// skeleton-shimmer 유틸 재사용(새 애니메이션·인위 지연 없음).

// page.tsx 로컬 상수 card 짝 — export 안 된 로컬 const라 참조 불가, 리터럴 동기 유지
const card =
  'bg-card rounded-card border border-border px-[18px] py-[22px] sm:px-6 sm:py-[26px]';

// 라벨 자리 — 실물 label(text-xs lh 16 + mb-1.5)과 동일 점유
function LabelBar() {
  return (
    <div className="h-4 mb-1.5 flex items-center">
      <div className="h-3 w-12 rounded skeleton-shimmer" />
    </div>
  );
}

// 섹션 헤더 자리 — ActivityDashboardCard·RecentActivityCard 헤더 짝.
// 제목 text-[20px]/[22px]는 arbitrary라 lh 상속(1.5) = 30/33px 박스.
// 2px 실선은 로딩 중 숨김(사용자 판정: 진한 선이 로딩 화면에서 먼저 보이는 게 어색) —
// border-transparent로 2px 자리는 유지해 전환 시프트 없음.
function SectionHeaderBar() {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-transparent pb-2 sm:pb-2.5">
      <div className="h-[30px] sm:h-[33px] flex items-center">
        <div className="h-5 sm:h-6 w-24 rounded skeleton-shimmer" />
      </div>
      <div className="h-4 sm:h-5 w-16 shrink-0 rounded skeleton-shimmer" />
    </div>
  );
}

export default function Loading() {
  return (
    // 폭: page.tsx 래퍼와 동일 토큰(--reading-w = 860, 0536)
    <div aria-hidden className="max-w-[var(--reading-w)] mx-auto">
      {/* 인사말 짝 — 눈썹(text-xs lh 16 + mb-1.5/2) + h1(text-[26px]/[28px] arbitrary → lh 1.5 = 39/42px 박스) */}
      <div className="mb-6 sm:mb-9">
        <div className="h-4 mb-1.5 sm:mb-2 flex items-center">
          <div className="h-3 w-16 rounded skeleton-shimmer" />
        </div>
        <div className="h-[39px] sm:h-[42px] flex items-center">
          <div className="h-7 sm:h-8 w-56 rounded skeleton-shimmer" />
        </div>
      </div>

      {/* 2열 조판 — page.tsx 그리드(1fr_400px·gap-12) 짝 */}
      <div className="space-y-[34px] md:space-y-0 md:grid md:grid-cols-[1fr_400px] md:gap-12 md:items-start">
        {/* 왼쪽: 개방 캔버스 */}
        <div className="flex flex-col">
          {/* AvatarDisplay 짝 — 원 64/88px + 이름(text-lg·xl 모두 lh 28)·이메일(text-sm lh 20) */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-[88px] sm:h-[88px] rounded-full shrink-0 skeleton-shimmer" />
            <div className="flex flex-col gap-1">
              <div className="h-7 flex items-center">
                <div className="h-5 sm:h-6 w-24 rounded skeleton-shimmer" />
              </div>
              <div className="h-5 flex items-center">
                <div className="h-4 w-40 rounded skeleton-shimmer" />
              </div>
            </div>
          </div>

          {/* ActivityDashboardCard 짝 — 헤더·라벨·값 전부 shimmer */}
          <div className="mt-[28px] sm:mt-[34px]">
            <SectionHeaderBar />
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-0 py-[18px] sm:py-5 border-b border-border">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-1">
                  {/* 라벨 text-xs lh 16 / 값 text-[20px] arbitrary lh 1.5 = 30px 박스 */}
                  <div className="h-4 flex items-center">
                    <div className="h-3 w-10 rounded skeleton-shimmer" />
                  </div>
                  <div className="h-[30px] flex items-center">
                    <div className="h-5 w-10 rounded skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RecentActivityCard 짝 — 소제목(text-xs lh 16)·행 3개씩(쿼리 take:3 상한 = 대표형) */}
          <div className="mt-[30px] sm:mt-[38px]">
            <SectionHeaderBar />
            {['mt-4 sm:mt-5', 'mt-[22px] sm:mt-[26px]'].map((mt) => (
              <section key={mt}>
                <div className={`${mt} h-4 flex items-center`}>
                  <div className="h-3 w-14 rounded skeleton-shimmer" />
                </div>
                <ul className="mt-1">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 sm:gap-5 py-[13px] sm:py-[14px] border-b border-hairline"
                    >
                      {/* 행 제목 text-base lh 24 박스 */}
                      <div className="min-w-0 flex-1 h-6 flex items-center">
                        <div className="h-4 w-[60%] rounded skeleton-shimmer" />
                      </div>
                      <div className="h-4 w-16 shrink-0 rounded skeleton-shimmer" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        {/* 오른쪽: 설정 카드 3장 — 카드 테두리만 실색, 내용 전부 shimmer.
            카드 제목은 text-lg(lh 28) 박스. 버튼·input은 통 블록(높이 산식 각 주석). */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* NicknameForm + AvatarControls 짝 */}
          <div className={card}>
            <div className="h-7 flex items-center">
              <div className="h-5 w-20 rounded skeleton-shimmer" />
            </div>
            <div className="mt-[18px] sm:mt-5">
              <LabelBar />
              {/* 이메일 값 text-base lh 24 박스 */}
              <div className="h-6 flex items-center">
                <div className="h-4 w-40 rounded skeleton-shimmer" />
              </div>
            </div>
            <div className="mt-4 sm:mt-[18px]">
              <LabelBar />
              {/* input 짝 — h 52 = py 13×2 + text-base lh 24 + border 2 (NicknameForm inputClass) */}
              <div className="h-[52px] w-full rounded-lg skeleton-shimmer" />
            </div>
            <div className="mt-4 sm:mt-[18px]">
              <LabelBar />
              {/* 파일 선택 버튼 짝 — h 46 = py 12×2 + text-[15px] lh 1.5(22.5) (AvatarControls) */}
              <div className="h-[46px] w-full rounded-lg skeleton-shimmer" />
            </div>
            {/* 저장 버튼 짝 — h 50 = py 14×2 + text-[15px] lh 22.5 (NicknameForm) */}
            <div className="mt-5 sm:mt-[22px] h-[50px] w-full rounded-lg skeleton-shimmer" />
          </div>

          {/* PasswordForm 짝 */}
          <div className={card}>
            <div className="h-7 flex items-center">
              <div className="h-5 w-28 rounded skeleton-shimmer" />
            </div>
            <div className="mt-[18px] sm:mt-5 flex flex-col gap-3.5">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <LabelBar />
                  <div className="h-[52px] w-full rounded-lg skeleton-shimmer" />
                </div>
              ))}
            </div>
            <div className="mt-5 sm:mt-[22px] h-[50px] w-full rounded-lg skeleton-shimmer" />
          </div>

          {/* DangerZoneCard 짝(접힘 상태) */}
          <div className={card}>
            <div className="h-7 flex items-center">
              <div className="h-5 w-20 rounded skeleton-shimmer" />
            </div>
            {/* WarningBox 짝 — h 192 ≈ p-4 32 + bold줄 20 + mt-2 8 + 본문 5줄(lh 1.55) 108.5 + gap 24.
                문안 줄바꿈이 컬럼 폭 의존이라 근사(데스크톱 400px 열, 줄당 1행 기준) */}
            <div className="mt-[14px] sm:mt-4 h-[192px] w-full rounded-lg skeleton-shimmer" />
            {/* 회원 탈퇴 버튼 짝 — h 48 = py 13×2 + text-[15px] lh 22.5 (DangerZoneCard) */}
            <div className="mt-4 sm:mt-[18px] h-[48px] w-full rounded-lg skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
