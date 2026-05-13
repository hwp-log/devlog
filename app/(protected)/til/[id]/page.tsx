import { notFound } from 'next/navigation';
import { getTilEntry } from '@/lib/til/actions';
import TilDetail from './TilDetail';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TilDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getTilEntry(id);

  if ('error' in result) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <TilDetail entry={result.data.entry} />
    </div>
  );
}
