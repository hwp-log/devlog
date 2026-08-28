'use client';
import { useEffect, useState } from 'react';

const HEADLINES = [
  '어디서 촬영했을까요?',
  '지도에서 촬영지를 찾아보세요',
  '그 장면, 어디서 찍었을까요?',
];

export function SpotFinderHeader() {
  const [headline, setHeadline] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- React Compiler 대비 규칙. 현재 동작 정상이며, 해소하려면 구조 변경이 필요해 별건으로 남김 (랜덤 헤드라인은 SSR/CSR 불일치를 피하려 마운트 후 결정 — hydration 안전 때문에 useState 초기화 불가)
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  }, []);

  return (
    <div className="mb-6">
      <p
        className="text-xs font-semibold text-primary mb-1 appear-up"
        style={{ animationDelay: '0s' }}
      >
        SpotFinder
      </p>
      <h1
        className="text-xl md:text-3xl font-bold text-fg break-keep appear-up"
        style={{ animationDelay: '0.12s' }}
      >
        {headline}
      </h1>
    </div>
  );
}
