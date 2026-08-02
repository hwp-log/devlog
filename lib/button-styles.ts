// 버튼 표준 클래스 상수(0477) — 3(강조)×2(위험) 격자의 단일 소스.
// 공용 컴포넌트가 아닌 상수인 이유: 사용처 13곳이 button·label·submit(form 연결)·
// ref(cancelRef)·onMouseDown preventDefault(에디터 포커스 보존) 등 시그니처가 제각각이라
// 컴포넌트화하면 prop 표면이 스타일보다 커진다. TOOL_SHELL(ToolList.tsx) 선례 승계.
// 폭(w-full/flex-1)·아이콘은 사이트 로컬로 덧붙인다.
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
// 세컨더리 테두리는 유지(0460 처방) — surface2 호스트 면에서 popover/card 면 교체는
// 라이트 1.04:1·다크 1.05:1로 식별 불가 실측(0477), 테두리(1.22~1.28:1)가 정지 구분 담당.

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
