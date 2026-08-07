// 버튼 표준 클래스 상수(0477) — 3(강조)×2(위험) 격자 + 확장 2셀(0533)의 단일 소스.
// 공용 컴포넌트가 아닌 상수인 이유: 사용처 13곳이 button·label·submit(form 연결)·
// ref(cancelRef)·onMouseDown preventDefault(에디터 포커스 보존) 등 시그니처가 제각각이라
// 컴포넌트화하면 prop 표면이 스타일보다 커진다. TOOL_SHELL(ToolList.tsx) 선례 승계.
// 폭(w-full/flex-1)·아이콘·등장 모션은 사이트 로컬로 덧붙인다.
//
// 0533 확장 경위: 버튼 표준이 두 벌이었다 — 이 격자(text-sm/medium)와 0529 회고의
// "버튼 3급"(15px/bold). 0529 3급은 격자를 대체한 게 아니라 0477이 못 본 자리
// (전폭 폼 제출 — 0477 대상 13곳은 전부 인라인 버튼)에서 자란 것이라, 별도 표준을
// 폐기하고 격자에 셀로 편입한다(BTN_SUBMIT). 네 갈래로 독립 발생한 필형 CTA도
// 쓰이는 자리가 일관돼(본문 흐름 밖의 진입점) 축으로 인정한다(BTN_NAV).
//
// 격자 배정(0477 확정, 0478 보강):
// - 프라이머리·일반: 스토리 등록/수정 / 스팟 수정(0478 승격 — 옆에 기준 강조가 없어 약해 보임)
// - 프라이머리·파괴: 스팟 삭제 (0478 신설 — 빨간 채움+흰 글씨, dangerFill 토큰 세트)
// - 세컨더리·일반: 스팟 취소 / 서식 그대로 두기
// - 세컨더리·파괴: 양식 바꾸기 (danger 토큰 세트, 아이콘+라벨 병행 — 색 단독 금지)
// - 터셔리·일반: 표면 위 원형 ×(BTN_ICON) / 인라인 마이크로 ×(BTN_TEXT)
// - 격자 예외: 사진 위 오버레이(닫기·교체·비우기 — 미디어 가독성 전제가 다름), 별점
//
// 형태 표준 rounded-lg·font-medium·opacity-50 근거: 세컨더리·파괴가 전부 rounded-lg —
// 곡률·타이포를 고정하고 색·채움만 강조 축으로 쓴다(형태까지 다르면 축이 둘).
// 세컨더리 테두리는 유지(0460 처방) — 호스트 면과 popover/card 면의 교체는
// 라이트 1.04:1·다크 1.05:1로 식별 불가 실측(0477), 테두리(1.22~1.28:1)가 정지 구분 담당.
// (0533: 구 주석의 "surface2 호스트 면" 전제 문구 제거 — 소비처 4곳 중 2곳(FormatMenu의
// card 면·개방 캔버스)이 이미 밖이었고, 결론이 "테두리가 구분 담당"이라 테두리가 있는 한
// 어느 면 위든 성립한다. 전제가 결론을 제약하지 않으므로 실측 수치만 남긴다.)

export const BTN_PRIMARY =
  'min-h-[44px] rounded-lg px-4 text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const BTN_SECONDARY =
  'min-h-[44px] rounded-lg px-4 text-sm font-medium bg-surface2 text-fg2 border border-border hover:bg-popover transition-colors disabled:opacity-50';

// 파괴 채움(0478) — 형태는 BTN_PRIMARY 동일, 색만 dangerFill(흰 글씨 4.5:1 이상 보장 —
// 값 근거 theme.ts). 아이콘+라벨 병행 전제라 flex 센터링 포함
export const BTN_PRIMARY_DANGER =
  'min-h-[44px] rounded-lg px-4 text-sm font-medium bg-danger-fill text-white hover:bg-danger-fill-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1';

export const BTN_SECONDARY_DANGER =
  'min-h-[44px] rounded-lg px-4 text-sm font-medium text-danger border border-danger-border hover:bg-danger-surface transition-colors flex items-center justify-center gap-1';

// 칩 아이콘 버튼(0481 최종 — 고스트→테두리원형→채움→테두리정사각→글리프→surface2 칩으로
// 수렴): 개방 캔버스(0371)에서 글리프만은 콜아웃·카드(surface2 면)와 재질 불일치 —
// 콜아웃과 같은 면(globals.css 콜아웃 background: var(--surface2), 0455)에 올린다. 테두리
// 없음. 시각 36px + before -inset-1 히트 44px(§5, 의사요소 클릭은 버튼 귀속), 인접 gap-3
// (히트 간 4px — 비가역 삭제 보호). hover = popover 면 + 글리프 명도/색 병행(면 반응
// 단독은 1.04~1.05:1로 불가시 — 0477 실측). 글리프 색은 사이트 로컬(무채 fg2 기본,
// 파괴만 hover:text-danger — 위험 신호는 의도 접근 시점에)
export const BTN_ICON_CHIP =
  'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface2 hover:bg-popover transition-colors before:absolute before:-inset-1 before:content-[""]';

// 표면 위 원형 × — 시각 28px(w-7)는 §5 44px 미달의 기존 위반 승계, 히트 확장은 별도 사이클
export const BTN_ICON =
  'w-7 h-7 rounded-full bg-surface2 border border-border hover:bg-popover flex items-center justify-center transition-colors';

export const BTN_TEXT = 'text-muted hover:text-fg2 transition-colors';

// ── 0533 확장 셀 ─────────────────────────────────────────────────────────────
// 이번 사이클엔 정의만 — 사용처 치환은 다음 사이클(0531 SectionHeader와 같은 순서).

// 내비게이션 CTA 축(0533 신설) — rounded-full. "곡률·타이포 고정" 원칙의 **명시적 예외**:
// 이 축은 본문 안의 액션(제출·확인·삭제)이 아니라 **본문 흐름 밖의 이동 진입점**
// (지도 위 부유 / 헤더 크롬 / 상세 하단 / 빈 상태 CTA)이라 역할이 다르고, 필형이
// "여기서 다른 곳으로 간다"는 신호를 담당한다 — 격자 예외(사진 위 오버레이)와 같은 결.
//
// 출처: 네 갈래 독립 발생 7곳의 수렴(0533 조사 — 공통 결정 이력 없음 확인).
//   SpotFinder 계보(0224→0280) / 헤더 Write(0302) / 상세 "다른 이야기 보기"(0376→0377
//   등급 재판단 보류분) / 빈 상태·목록 CTA(0136→0412→0530).
// 값 근거: 14px/600은 7곳 중 5곳(vs 13px 1곳·12.5px 1곳 — 둘 다 실측 판정 기록 없음),
//   그중 최신 판정(0530 my-plan)이자 §5 44px을 지키는 유일 조합(min-h-11)과 일치.
//   px-[18px]·hover:bg-primary/90도 각각 0530 최신·4곳 다수. 흰 글자는 0530 확정 승계.
// ⚠ 적용 예고: AppHeader Write(12.5px·py-[7px])는 h-14(56px) 크롬 안이라 44px 필이
//   갑갑할 수 있다 — 치환 사이클에서 실화면 보고 판정, 격자 예외로 남을 수 있음.
//   my-plan의 부양 모션(hover:-translate-y 등)은 사이트 로컬 덧붙임(폭·아이콘과 동급).
export const BTN_NAV =
  'inline-flex items-center justify-center gap-1.5 min-h-11 rounded-full bg-primary px-[18px] text-sm font-semibold text-white hover:bg-primary/90 transition-colors';

// 프라이머리·제출 셀(0533 신설) — 전폭 폼 제출 전용. 0477이 못 본 자리(당시 13곳은 전부
// 인라인 버튼)에서 0515가 원형(15px/bold)을 만들고 0529가 "버튼 3급"이라는 별도 표준으로
// 확산시킨 것을 격자로 회수한다. **0529 회고의 "버튼 3급"은 이 격자로 흡수됨** —
// 정본은 여기(코드)이고 회고는 당시 기록으로 유지한다(과거 문서는 고치지 않는다, 0533).
// 값 근거: 15px/700은 5곳 중 3곳 + 0515 원형(vs 16px 2곳 — MyPlanNewForm 0527 아류.
//   16px 하한(§5)은 입력 필드의 iOS 자동확대 방지 규칙이라 버튼엔 적용 근거 없음).
//   py-[14px]: 총 높이 ≈50px ≥ 44(§5). 비활성은 opacity-50 + cursor-not-allowed로 통일
//   (기존 5셀 전부 opacity-50 — MyPlanNewForm의 opacity-40은 아류로 기각).
// 흰 글자(0530 확정 승계): primary 면 위 2.74:1로 AA(4.5) 미달을 알고 수용 —
//   바꿀 땐 primary 채움 전체(BTN_PRIMARY·BTN_NAV 포함)를 함께(0530 주석과 짝).
export const BTN_SUBMIT =
  'w-full py-[14px] rounded-lg bg-primary text-white text-[15px] font-bold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
