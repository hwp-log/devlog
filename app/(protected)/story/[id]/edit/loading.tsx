// 0491: 수정 진입 로딩 — 자체 loading으로 0490 부수효과(상세 스켈레톤이 edit fallback으로 뜨던 것) 해소.
// 골격은 글쓰기와 공유(StoryWriteSkeleton). edit 자체 loading이 [id]/loading보다 우선.
import { StoryWriteSkeleton } from '@/app/(protected)/story/new/StoryWriteSkeleton';

export default function Loading() {
  return <StoryWriteSkeleton />;
}
