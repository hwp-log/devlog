'use client';
import { useEffect, useState } from 'react';

const HEADLINES = [
  '어떤 여행이 기다리고 있을까요?',
  '다른 여행자들의 발자취를 따라가 볼까요?',
  '마음에 드는 코스를 찾아보세요',
  '이 코스들, 누군가는 이미 다녀왔어요',
];

export function PlanFinderHeader() {
  const [headline, setHeadline] = useState('');

  useEffect(() => {
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  }, []);

  return (
    <div className="mb-6">
      <p
        className="text-xs font-semibold text-sky-500 mb-1 appear-up"
        style={{ animationDelay: '0s' }}
      >
        PlanFinder
      </p>
      <h1
        className="text-2xl md:text-3xl font-bold text-[#1A1A1A] appear-up"
        style={{ animationDelay: '0.12s' }}
      >
        {headline}
      </h1>
    </div>
  );
}
