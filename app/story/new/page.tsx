import { StoryWriteForm } from './StoryWriteForm';
import { createStoryAction } from './actions';

export default function StoryNewPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">새 스토리 작성</h1>
      <p className="text-sm text-slate-500 mb-6">다녀온 그 장소, 당신의 이야기를 남겨주세요</p>
      <div className="glass-outer p-8">
        <StoryWriteForm action={createStoryAction} />
      </div>
    </div>
  );
}
