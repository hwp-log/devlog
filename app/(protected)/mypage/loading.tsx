// 0539: MyPage 진입 로딩 — 서버 조회(프로필 + count 3종 + 최근 활동, Promise.all) 동안
//   모바일 탭 후 무피드백 해소용 route-level fallback (0491 스토리 작성·수정 방식 준용).
// 원칙: MyPage는 뭐가 뜰지 아는 화면 — **틀·라벨은 실물로, 서버 데이터 자리만 shimmer**
//   (전체 회색 덩어리 금지). 비밀번호 변경·계정 삭제 카드는 데이터 0이라 통째 실물.
// 구조 클래스는 page.tsx 및 각 컴포넌트의 짝 블록 리터럴 준용(0491 C-4) —
//   **한쪽만 바꾸면 스켈레톤→실콘텐츠 전환 시 시프트가 생긴다** (각 블록 주석에 짝 명시).
// skeleton-shimmer 유틸 재사용(새 애니메이션 없음). 버튼·input은 표시용 비인터랙티브.

// page.tsx 로컬 상수 card 짝 — export 안 된 로컬 const라 참조 불가, 리터럴 동기 유지
const card =
  'bg-card rounded-card border border-border px-[18px] py-[22px] sm:px-6 sm:py-[26px]';

// NicknameForm·PasswordForm inputClass 짝 — 실 input 높이 = py-[13px]×2 + text-base 줄높이 24 + border 2 = 52px
const inputShell =
  'w-full h-[52px] border border-field-border rounded-lg px-[14px] flex items-center';

const labelClass = 'text-xs font-medium text-muted mb-1.5 block';

export default function Loading() {
  return (
    // 폭: page.tsx 래퍼와 동일 토큰(--reading-w = 860, 0536)
    <div aria-hidden className="max-w-[var(--reading-w)] mx-auto">
      {/* 인사말 — 눈썹·"안녕하세요," 는 실물, 닉네임 자리만 인라인 shimmer (대표형: 닉네임 있음) */}
      <div className="mb-6 sm:mb-9">
        <p className="text-xs font-semibold tracking-[0.12em] uppercase text-primary mb-1.5 sm:mb-2">
          MyPage
        </p>
        <h1 className="text-[26px] sm:text-[28px] font-bold tracking-[-0.02em] text-fg break-keep">
          안녕하세요,{' '}
          <span className="inline-block h-[0.9em] w-24 rounded align-baseline skeleton-shimmer" />님
        </h1>
      </div>

      {/* 2열 조판 — page.tsx 그리드(1fr_400px·gap-12) 짝 */}
      <div className="space-y-[34px] md:space-y-0 md:grid md:grid-cols-[1fr_400px] md:gap-12 md:items-start">
        {/* 왼쪽: 개방 캔버스 */}
        <div className="flex flex-col">
          {/* AvatarDisplay 짝 — 원 64/88px + 이름·이메일 2줄 */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-[88px] sm:h-[88px] rounded-full shrink-0 skeleton-shimmer" />
            <div className="flex flex-col gap-1">
              {/* 이름 text-lg·sm:text-xl 모두 lh 28px */}
              <div className="h-7 flex items-center">
                <div className="h-5 sm:h-6 w-24 rounded skeleton-shimmer" />
              </div>
              <div className="h-5 flex items-center">
                <div className="h-4 w-40 rounded skeleton-shimmer" />
              </div>
            </div>
          </div>

          {/* ActivityDashboardCard 짝 — 헤더·라벨 실물, 값 4개만 shimmer */}
          <div className="mt-[28px] sm:mt-[34px]">
            <div className="flex items-baseline justify-between gap-3 border-b-2 border-section-rule pb-2 sm:pb-2.5">
              <h2 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.02em] text-fg break-keep">
                내 활동
              </h2>
              <span className="text-xs sm:text-sm text-muted shrink-0">
                <span className="sm:hidden">누적</span>
                <span className="max-sm:hidden">가입 이후 누적</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-0 py-[18px] sm:py-5 border-b border-border">
              {['스토리', '계획', '받은 좋아요', '평균 예산'].map((label) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">{label}</span>
                  {/* 값 자리 — text-[20px]는 arbitrary라 lh 상속(1.5) = 30px 박스 */}
                  <div className="h-[30px] flex items-center">
                    <div className="h-5 w-10 rounded skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RecentActivityCard 짝 — 헤더·소제목 실물, 행 3개씩 shimmer (쿼리 take:3 상한 = 대표형) */}
          <div className="mt-[30px] sm:mt-[38px]">
            <div className="flex items-baseline justify-between gap-3 border-b-2 border-section-rule pb-2 sm:pb-2.5">
              <h2 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.02em] text-fg break-keep">
                최근 활동
              </h2>
              <span className="text-xs sm:text-sm text-muted shrink-0">최신순</span>
            </div>
            {[
              { heading: '최근 스토리', mt: 'mt-4 sm:mt-5' },
              { heading: '최근 계획', mt: 'mt-[22px] sm:mt-[26px]' },
            ].map(({ heading, mt }) => (
              <section key={heading}>
                <h3 className={`${mt} text-xs font-medium tracking-[0.04em] text-muted`}>
                  {heading}
                </h3>
                <ul className="mt-1">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 sm:gap-5 py-[13px] sm:py-[14px] border-b border-hairline"
                    >
                      {/* 행 텍스트 높이 = text-base 줄높이 24px 박스 유지 */}
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

        {/* 오른쪽: 설정 카드 3장 — 틀·제목·라벨·버튼 실물 */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* NicknameForm + AvatarControls 짝 — 데이터는 이메일 값·닉네임 input 값뿐 */}
          <div className={card}>
            <h2 className="text-lg font-bold tracking-[-0.01em] text-fg">계정 설정</h2>
            <div className="mt-[18px] sm:mt-5">
              <span className={labelClass}>이메일</span>
              <div className="h-6 flex items-center">
                <div className="h-4 w-40 rounded skeleton-shimmer" />
              </div>
            </div>
            <div className="mt-4 sm:mt-[18px]">
              <span className={labelClass}>닉네임</span>
              <div className={inputShell}>
                <div className="h-4 w-24 rounded skeleton-shimmer" />
              </div>
            </div>
            {/* AvatarControls 짝 — 조건부 버튼(사진 저장·제거)은 생략(0491 C-2), 상시 노출만 */}
            <div className="mt-4 sm:mt-[18px]">
              <span className={labelClass}>프로필 사진</span>
              <div className="w-full py-3 rounded-lg border border-field-border text-fg2 text-[15px] font-medium text-center">
                파일 선택
              </div>
            </div>
            <div className="mt-5 sm:mt-[22px] w-full py-[14px] rounded-lg bg-primary text-white text-[15px] font-bold text-center">
              저장
            </div>
          </div>

          {/* PasswordForm 짝 — 전부 클라이언트 초기 상태(빈 값)라 데이터 0, 통째 실물 */}
          <div className={card}>
            <h2 className="text-lg font-bold tracking-[-0.01em] text-fg">비밀번호 변경</h2>
            <div className="mt-[18px] sm:mt-5 flex flex-col gap-3.5">
              {['현재 비밀번호', '새 비밀번호', '새 비밀번호 확인'].map((label) => (
                <div key={label}>
                  <span className={labelClass}>{label}</span>
                  <div className={inputShell} />
                </div>
              ))}
            </div>
            <div className="mt-5 sm:mt-[22px] w-full py-[14px] rounded-lg bg-primary text-white text-[15px] font-bold text-center">
              비밀번호 변경
            </div>
          </div>

          {/* DangerZoneCard 짝(접힘 상태) — 전부 정적이라 데이터 0, 통째 실물 */}
          <div className={card}>
            <h2 className="text-lg font-bold tracking-[-0.01em] text-fg">계정 삭제</h2>
            <div className="mt-[14px] sm:mt-4 rounded-lg bg-danger-surface border-l-4 border-danger p-4">
              <p className="text-sm font-bold text-danger">탈퇴하면 되돌릴 수 없습니다</p>
              <div className="mt-2 flex flex-col gap-1.5 text-sm leading-[1.55] text-fg2">
                <p>이메일과 프로필 사진은 삭제됩니다.</p>
                <p>작성한 스토리 · 계획은 &lsquo;익명의 계정명&rsquo;으로 남습니다.</p>
                <p>익명의 계정명은 &lsquo;잊혀진 여행자&rsquo;로 변경 · 표시됩니다.</p>
                <p>다시 가입하더라도 예전에 작성한 글과 계획을 연결할 수 없습니다.</p>
                <p className="font-semibold text-danger">로그인은 다시 할 수 없습니다.</p>
              </div>
            </div>
            <div className="mt-4 sm:mt-[18px] w-full py-[13px] rounded-lg border border-danger text-danger text-[15px] font-semibold text-center">
              회원 탈퇴
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
