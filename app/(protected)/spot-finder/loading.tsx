// 스팟파인더 첫 진입(서버 페치 중) 로딩 스켈레톤 — 0413.
// 다른 화면에서 이동해 올 때의 진입 표시. 화면 내 로딩과는 별개 층.
// page.tsx의 dynamic-import 폴백(SpotFinderLoadingSkeleton)을 그대로 재사용 →
// 「진입 로딩 → 마운트 후 폴백」이 같은 화면이라 이음새 없음(단일 소스).
// 외곽 레이아웃은 page.tsx와 동일 치수(bg-bg-deep → h-spot-finder-map → bg-card 지도 영역).
// appear-up(0.24s 지연)은 제외 — 로딩 상태가 스스로 지연 페이드하면 표시가 늦어짐.
import SpotFinderLoadingSkeleton from '@/components/SpotFinderLoadingSkeleton';

export default function Loading() {
  return (
    <div className="bg-bg-deep" aria-hidden>
      <div className="h-spot-finder-map min-h-[440px]">
        <div className="relative h-full rounded-none bg-card lg:overflow-hidden">
          <SpotFinderLoadingSkeleton />
        </div>
      </div>
    </div>
  );
}
