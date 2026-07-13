'use client';
import dynamic from 'next/dynamic';

// 네이버 지도 사용
const SpotFinderMap = dynamic(() => import('./SpotFinderMapNaver'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-card animate-pulse" />,
});

export default SpotFinderMap;
