// 0491: 글쓰기 진입 로딩 — 무피드백(클릭 후 블랭크) 해소용 route-level fallback.
// 골격은 수정 화면과 공유(StoryWriteSkeleton) — 같은 StoryWriteForm·헤더 치수라 1벌.
import { StoryWriteSkeleton } from './StoryWriteSkeleton';

export default function Loading() {
  return <StoryWriteSkeleton />;
}
