const HEADLINE = '여행자들의 이야기';

export function StoryHeader() {
  return (
    <div>
      <p
        className="text-xs font-semibold text-primary mb-1 appear-up"
        style={{ animationDelay: '0s' }}
      >
        Story
      </p>
      <h1
        className="text-xl md:text-3xl font-bold text-fg break-keep appear-up"
        style={{ animationDelay: '0.12s' }}
      >
        {HEADLINE}
      </h1>
    </div>
  );
}
