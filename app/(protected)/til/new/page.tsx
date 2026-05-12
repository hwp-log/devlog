import { createTilEntryAction } from './actions';
import { TilForm } from './TilForm';

export default function TilNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-700">TIL 작성</h2>
      </div>
      <TilForm action={createTilEntryAction} />
    </div>
  );
}
