'use client';
import { useEffect, useState } from 'react';

const HEADLINES = [
  '어떤 여행이 기다리고 있을까요?',
  '다른 여행자들의 발자취를 따라가 볼까요?',
  '마음에 드는 코스를 찾아보세요',
  '이 코스들, 누군가는 이미 다녀왔어요',
];

type CursorPhase = 'typing' | 'lingering' | 'fading' | 'done';

export function PlanFinderHeader() {
  const [headline, setHeadline]       = useState('');
  const [shown, setShown]             = useState('');
  const [cursorPhase, setCursorPhase] = useState<CursorPhase>('typing');

  useEffect(() => {
    const picked = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
    setHeadline(picked);

    let i = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const step = () => {
      i += 1;
      setShown(picked.slice(0, i));
      if (i < picked.length) {
        timeoutId = setTimeout(step, 100);
      } else {
        setCursorPhase('lingering');
        timeoutId = setTimeout(() => {
          setCursorPhase('fading');
          timeoutId = setTimeout(() => setCursorPhase('done'), 300);
        }, 3050);
      }
    };
    timeoutId = setTimeout(step, 100);

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-sky-500 mb-1">PlanFinder</p>
      <h1
        aria-label={headline}
        className="text-2xl md:text-3xl font-bold text-[#1A1A1A] min-h-[2.25rem]"
      >
        <span aria-hidden="true">{shown}</span>
        {cursorPhase !== 'done' && (
          <span
            aria-hidden="true"
            className="inline-block w-[2px] h-[1em] bg-sky-500 ml-[2px] align-[-0.15em] transition-opacity duration-300"
            style={{
              animation: cursorPhase === 'fading' ? 'none' : 'blink 1s ease-in-out infinite',
              opacity:   cursorPhase === 'fading' ? 0 : 1,
            }}
          />
        )}
      </h1>
    </div>
  );
}
