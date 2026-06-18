'use client';
import dynamic from 'next/dynamic';

const SpotFinderMap = dynamic(() => import('./SpotFinderMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 animate-pulse" />,
});

export default SpotFinderMap;
