'use client';

import dynamic from 'next/dynamic';

const SpotMap = dynamic(() => import('./SpotMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-slate-100 animate-pulse" />
  ),
});

export default SpotMap;
