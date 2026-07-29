// 플랜 카드 그리드 로딩 스켈레톤 — 실제 PlanListClient 그리드 / PlanCard와 동일 치수.
// PlanCard는 표면 전체가 커버 이미지(오버레이 + 하단 흰 텍스트)라 내용 전부가 "아직 모르는 것"
// → 카드 표면 전체를 셔머로(내부 텍스트 바를 그리면 셔머 위 셔머가 됨).
// 셔머는 기존 skeleton-shimmer 유틸 재사용(globals.css, popover/surface2 토큰 · 라이트/다크 자동).
// 훅·상태 없는 순수 컴포넌트 — 서버 컴포넌트(loading.tsx)에서 import 가능.
export function PlanSkeletonGrid({ count }: { count: number }) {
  return (
    <div
      aria-hidden
      // 0425: PlanListClient 그리드와 클래스 동일 유지 필수(한쪽만 바꾸면 로딩 전환 시 레이아웃 시프트).
      // 열 수 1·2·3·4·6(PLAN_PAGE_SIZE 12의 약수)·브레이크포인트 근거는 PlanListClient 주석 참조.
      className="grid grid-cols-[minmax(min(320px,100%),1fr)] min-[704px]:grid-cols-2 min-[1040px]:grid-cols-3 min-[1372px]:grid-cols-4 min-[2040px]:grid-cols-6 gap-[11px] sm:gap-[14px]"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-[240px] sm:h-[280px] rounded-[14px] border border-border"
        />
      ))}
    </div>
  );
}
