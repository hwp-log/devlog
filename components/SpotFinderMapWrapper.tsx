'use client';
import dynamic from 'next/dynamic';
import SpotFinderLoadingSkeleton from './SpotFinderLoadingSkeleton';

// 네이버 지도 사용
// 0278: dynamic-import 폴백을 3열 셔머 스켈레톤으로 교체(청크 로드 전 유일 구간). 마운트 후엔
// SpotFinderMapNaver가 리스트·상세를 실데이터로 즉시 렌더하고 지도 슬롯만 로딩 서피스를 보인다.
const SpotFinderMap = dynamic(() => import('./SpotFinderMapNaver'), {
  ssr: false,
  loading: () => <SpotFinderLoadingSkeleton />,
});

export default SpotFinderMap;
