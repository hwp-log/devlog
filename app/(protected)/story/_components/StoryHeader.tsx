const HEADLINE = '여행자들의 이야기';

// animate: 등장 애니메이션(appear-up)을 켤지 — 진입 로딩(loading.tsx)에서만 true.
// 스켈레톤에서 한 번 재생하고, 로딩 종료 후 실제 콘텐츠 헤더는 정적으로 두어 이중 재생을 막는다(0445).
// (0413: 정적 텍스트라 실제 헤더를 두 경로에 그대로 렌더 → Suspense 폴백→콘텐츠 전환 시 재마운트로 애니메이션 2회 재생되던 문제.)
export function StoryHeader({ animate = false }: { animate?: boolean }) {
  return (
    <div>
      <p
        className={`text-[12px] font-medium uppercase tracking-wider text-primary mb-0${animate ? ' appear-up' : ''}`}
        style={animate ? { animationDelay: '0s' } : undefined}
      >
        Story
      </p>
      <h1
        className={`text-[20px] font-semibold text-fg break-keep${animate ? ' appear-up' : ''}`}
        style={animate ? { animationDelay: '0.12s' } : undefined}
      >
        {HEADLINE}
      </h1>
    </div>
  );
}
