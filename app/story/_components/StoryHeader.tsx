'use client';
import { useEffect, useState } from 'react';

const HEADLINES = [
  '이런 이야기들이 기다리고 있어요',
  '다른 사람들의 여행 이야기를 들여다볼까요?',
  '촬영지마다 담긴 이야기가 있어요',
  '어떤 장면이 당신을 기다릴까요?',
];

export function StoryHeader() {
  const [headline, setHeadline] = useState('');

  useEffect(() => {
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  }, []);

  return (
    <div>
      <p
        className="text-xs font-semibold text-sky-500 mb-1 appear-up"
        style={{ animationDelay: '0s' }}
      >
        Story
      </p>
      <h1
        className="text-2xl md:text-3xl font-bold text-[#1A1A1A] break-keep appear-up"
        style={{ animationDelay: '0.12s' }}
      >
        {headline}
      </h1>
    </div>
  );
}
