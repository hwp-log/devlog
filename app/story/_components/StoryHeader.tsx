const HEADLINE = '여행자들의 이야기';

export function StoryHeader() {
  return (
    <div>
      <p
        className="text-[12px] font-medium uppercase tracking-wider text-primary mb-0 appear-up"
        style={{ animationDelay: '0s' }}
      >
        Story
      </p>
      <h1
        className="text-[20px] font-semibold text-fg break-keep appear-up"
        style={{ animationDelay: '0.12s' }}
      >
        {HEADLINE}
      </h1>
    </div>
  );
}
