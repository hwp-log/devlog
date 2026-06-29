import { fetchSpotFinderSpots } from '@/lib/spot/queries';
import SpotFinderMapWrapper from '@/components/SpotFinderMapWrapper';
import { SpotFinderHeader } from './_components/SpotFinderHeader';

export default async function SpotFinderPage() {
  const spots = await fetchSpotFinderSpots();

  return (
    <div>
      <SpotFinderHeader />
      <div className="h-[calc(100vh-200px)] min-h-[440px]">
        <div
          className="relative h-full rounded-2xl overflow-hidden bg-white
                     shadow-[0_30px_80px_rgba(0,0,0,0.22),0_10px_24px_rgba(0,0,0,0.14)]"
        >
          <SpotFinderMapWrapper spots={spots} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl
                       shadow-[inset_0_4px_8px_rgba(255,255,255,0.6),inset_0_-14px_28px_rgba(0,0,0,0.16),inset_0_0_0_1px_rgba(0,0,0,0.05)]"
          />
        </div>
      </div>
    </div>
  );
}
