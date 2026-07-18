import { fetchSpotFinderSpots } from '@/lib/spot/queries';
import SpotFinderMapWrapper from '@/components/SpotFinderMapWrapper';

export default async function SpotFinderPage() {
  const spots = await fetchSpotFinderSpots();

  // 0284: data-theme="dark" 강제 제거 — 루트 토글(0283) 추종. 토큰 클래스는 무변
  return (
    <div className="bg-bg-deep">
      {/* 0225: 모바일 풀스크린 지도 배경(칩·카드 floating). 데스크탑은 rounded 없이 lg:overflow-hidden으로 3열 클립.
          lg:overflow-hidden — 모바일은 clip 없음(fixed 카드/모달이 appear-up transform 조상에 클리핑되지 않게). */}
      <div className="h-spot-finder-map min-h-[440px]">
        <div
          className="relative h-full rounded-none bg-card lg:overflow-hidden appear-up"
          style={{ animationDelay: '0.24s' }}
        >
          <SpotFinderMapWrapper spots={spots} />
        </div>
      </div>
    </div>
  );
}
