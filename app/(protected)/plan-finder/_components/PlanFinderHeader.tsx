export function PlanFinderHeader() {
  return (
    <div>
      {/* 눈썹·제목·간격을 StoryHeader와 동일 규격으로 통일(0441) — 두 목록 화면의 헤더 체감 일치. */}
      <p
        className="text-[12px] font-medium uppercase tracking-wider text-primary mb-0 appear-up"
        style={{ animationDelay: '0s' }}
      >
        PlanFinder
      </p>
      <h1
        className="text-[20px] font-semibold text-fg break-keep appear-up"
        style={{ animationDelay: '0.12s' }}
      >
        여행자들의 계획
      </h1>
    </div>
  );
}
