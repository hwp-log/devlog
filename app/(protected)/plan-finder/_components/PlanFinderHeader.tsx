// animate: 등장 애니메이션(appear-up)을 켤지 — 진입 로딩(loading.tsx)에서만 true.
// 스켈레톤에서 한 번 재생하고, 로딩 종료 후 실제 콘텐츠 헤더는 정적으로 두어 이중 재생을 막는다(0445). StoryHeader와 동일 처리.
export function PlanFinderHeader({ animate = false }: { animate?: boolean }) {
  return (
    <div>
      {/* 눈썹·제목·간격을 StoryHeader와 동일 규격으로 통일(0441) — 두 목록 화면의 헤더 체감 일치. */}
      <p
        className={`text-[12px] font-medium uppercase tracking-wider text-primary mb-0${animate ? ' appear-up' : ''}`}
        style={animate ? { animationDelay: '0s' } : undefined}
      >
        PlanFinder
      </p>
      <h1
        className={`text-[20px] font-semibold text-fg break-keep${animate ? ' appear-up' : ''}`}
        style={animate ? { animationDelay: '0.12s' } : undefined}
      >
        여행자들의 계획
      </h1>
    </div>
  );
}
