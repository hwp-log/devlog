import { fetchSpotFinderSpots } from '@/lib/spot/queries';
import SpotFinderMapWrapper from '@/components/SpotFinderMapWrapper';

export default async function SpotFinderPage() {
  const spots = await fetchSpotFinderSpots();

  // 0284: data-theme="dark" 강제 제거 — 루트 토글(0283) 추종. 토큰 클래스는 무변
  return (
    <div className="bg-bg-deep">
      {/* 0225: 모바일 풀스크린 지도 배경(칩·카드 floating). 데스크탑은 rounded 없이 lg:overflow-hidden으로 3열 클립.
          lg:overflow-hidden — 모바일은 clip 없음(하위 fixed 카드/모달이 클리핑되지 않게).
          0486: appear-up 제거 — 풀블리드 지도는 "카드 떠오름" 연출 대상이 아니고, 스켈레톤(appear-up 없음)→
          카드(translateY 10px) 교체가 진입 시 "툭 내려갔다 상승"을 만들었다. transform 소멸로 이 div는 더는
          하위 fixed(모바일 시트·모달)의 containing block이 아님 — 모바일은 div=100svh 풀블리드라 기준이 뷰포트로
          바뀌어도 위치 동일. */}
      <div className="h-spot-finder-map min-h-[440px]">
        <div className="relative h-full rounded-none bg-card lg:overflow-hidden">
          <SpotFinderMapWrapper spots={spots} />
        </div>
      </div>
    </div>
  );
}
