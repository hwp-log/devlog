'use client';
import { useEffect, useRef } from 'react';
import { StoryCard, type StoryCardProps } from '@/app/(protected)/story/_components/StoryCard';
import { CardReveal } from '@/app/(protected)/story/_components/CardReveal';

type MyStoryItem = StoryCardProps;

export function MyStoryCardGrid({ stories }: { stories: MyStoryItem[] }) {
  const initialPhaseRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      initialPhaseRef.current = false;
    }, 200);
    return () => clearTimeout(t);
  }, []);

  return (
    // 0532: 구 1/md:2/lg:3/xl:4는 0042 당시 /story 체계를 옮겨온 것으로, 이후 /story가 바뀔 때
    //   갱신되지 않아 네 번째 체계로 남아 있었다. 이 화면의 컨테이너로 재산출한다.
    //
    //   산출식(0425 형식): 임계 뷰포트 V(N) = N×하한 + gap×(N−1) + 48(px-6 좌우), 절상 후 +2.
    //   이 라우트는 ProtectedMain의 WIDE_ROUTES가 아니라 기본 분기라
    //   컨테이너 = min(뷰포트−48, 1232). gap = 24. 카드는 /story와 같은 StoryCard라 하한도 220 공유.
    //     · 2열: 2×220 + 24×1 + 48 = 512 → min-[514px]  | 514에서 카드 221.0
    //     · 3열: 3×220 + 24×2 + 48 = 756 → min-[758px]  | 758에서 220.7, 컨테이너캡에서 394.7
    //     · 4열: 4×220 + 24×3 + 48 = 1000 → min-[1002px] | 1002에서 220.5, 컨테이너캡에서 290.0
    //     · 6열은 성립하지 않는다: 6×220 + 24×5 = 1440 > 1232(컨테이너 상한).
    //   /story(WIDE, max-w 없음)는 같은 하한·같은 gap인데도 min-[1490px]:6이 더 붙는다 —
    //   숫자가 갈리는 건 복사 누락이 아니라 컨테이너가 달라서다. 옮길 땐 숫자가 아니라 산출식을 옮길 것.
    //
    //   하한 220 근거는 StoryCardList 주석 참조(메타 줄 실측 159px). 특히 날짜 폭은
    //   `2025년 12월 31일` 기준 91.2px으로 잡혀 있다 — formatStoryCardDate가 해가 바뀌면
    //   `M월 D일`(37.5)에서 `YYYY년 M월 D일`로 되돌리므로, 2027년 1월에 기존 스토리 전건이
    //   그 폭이 된다. 220은 그 상태를 이미 전제한 값이다.
    <div className="grid grid-cols-1 min-[514px]:grid-cols-2 min-[758px]:grid-cols-3 min-[1002px]:grid-cols-4 gap-6">
      {stories.map((story, i) => (
        <CardReveal key={story.id} index={i} initialPhaseRef={initialPhaseRef}>
          <StoryCard {...story} />
        </CardReveal>
      ))}
    </div>
  );
}
