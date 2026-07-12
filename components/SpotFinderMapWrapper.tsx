'use client';
import dynamic from 'next/dynamic';

// 네이버 전환 (카카오 롤백 = './SpotFinderMap'으로 1줄 리버트)
const SpotFinderMap = dynamic(() => import('./SpotFinderMapNaver'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-card animate-pulse" />,
});

export default SpotFinderMap;
