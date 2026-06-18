import { fetchSpotFinderSpots } from '@/lib/spot/queries';
import SpotFinderMapWrapper from '@/components/SpotFinderMapWrapper';

export default async function SpotFinderPage() {
  const spots = await fetchSpotFinderSpots();

  return (
    <div className="-mx-6 -my-8 h-[calc(100vh-56px)]">
      <SpotFinderMapWrapper spots={spots} />
    </div>
  );
}
