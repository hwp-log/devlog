// 0581: 플랜 날짜 하한 단일 소스 — 폼(클라이언트 min 속성)·서버 액션이 같은 함수를 쓴다.
//   클라만 막으면 우회되고, 서버만 막으면 사용자는 저장을 눌러야 안다.
//
// 상한 계열(headcount)은 validate-input.ts에 있다 — 파일이 갈린 건 축이 다르기 때문:
//   저쪽은 "값의 범위", 여기는 "오늘 기준 시점 판정"이라 KST·저장값 의존이 붙는다.
//   플랜 입력 검증을 더 만들 때는 두 파일 중 어느 축인지 먼저 정할 것.

/**
 * KST 기준 오늘 (YYYY-MM-DD).
 *
 * 로컬 시각을 쓰면 안 된다 — 배포 환경(Vercel)은 UTC라 한국 00:00~09:00 사이에
 * "어제"를 오늘로 판정한다. 그 창에서 사용자는 오늘 출발하는 계획을 저장할 수 없다.
 * 표시 계열이 Asia/Seoul을 명시하는 선례(plan-finder/[id]/page.tsx createdAtLabel)와 같은 결.
 * 'en-CA' 로케일은 YYYY-MM-DD로 포맷된다(date input의 value 형식과 동일).
 */
export function todayStrKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/**
 * DB의 DateTime → date input 형식(YYYY-MM-DD).
 * my-plan/[id]/edit/page.tsx가 initialState를 만들 때 쓰는 규칙과 **같아야 한다** —
 * 클라의 하한 기준(폼 초깃값)과 서버의 하한 기준(DB 값)이 갈리면 한쪽에서만 막힌다.
 */
export function savedDateStr(d: Date | null): string | null {
  return d ? d.toISOString().split('T')[0] : null;
}

/**
 * 출발일 하한 — 저장값이 이미 과거면 그 값, 아니면 오늘.
 *
 * "이미 지난 여행을 기록한 플랜은 그대로 저장되되, 새로 과거를 만들지는 못한다"가 규칙이다.
 * 하한을 무조건 오늘로 잡으면 과거 플랜(0581 시점 실측 1건 — 공개 시연 데이터)이
 * 날짜와 무관한 수정조차 저장 불가가 된다.
 */
export function minStartDate(saved: string | null): string {
  const today = todayStrKst();
  return saved && saved < today ? saved : today;
}

/**
 * 저장 직전 날짜 검증. 통과면 null, 아니면 사용자에게 보일 메시지.
 * create는 saved: null, update는 saved: 기존 저장값.
 *
 * 날짜 미설정(빈 문자열)은 허용 — startDate는 nullable이고 "아직 안 정한 계획"이 성립한다.
 * 이 함수는 하한만 본다. 상한(먼 미래)은 막지 않는다 — 몇 년 뒤 여행을 계획할 수 있다.
 */
export function validatePlanDates(input: {
  startDate: string;
  endDate: string;
  saved: string | null;
}): string | null {
  const { startDate, endDate, saved } = input;
  if (!startDate) return null;

  const min = minStartDate(saved);
  if (startDate < min) {
    // 하한이 오늘이면 신규 규칙, 저장값이면 "더 과거로는 못 간다"는 별개 사실 — 문구를 나눈다.
    return min === todayStrKst()
      ? '출발일은 오늘 이후로 선택해주세요'
      : `출발일을 기존 날짜(${min})보다 이전으로 바꿀 수 없습니다`;
  }
  // 문자열 YYYY-MM-DD는 사전순 비교 = 날짜순 비교(제로 패딩 고정 폭).
  if (endDate && endDate < startDate) return '도착일은 출발일 이후여야 합니다';
  return null;
}
