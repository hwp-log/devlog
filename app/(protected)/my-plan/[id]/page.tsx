import { redirect } from 'next/navigation';

// 0560: 상세 한 벌화 — /my-plan/[id] 폐기, 공개 상세(/plan-finder/[id])가 정본.
//   북마크·히스토리·기존 공유 링크 보호용 redirect 스텁 — 진입 0 확인되면 제거 예정.
//   접근 제어는 도착지의 visiblePlanWhere(0557)가 담당(남의 비공개는 404).
type Props = { params: Promise<{ id: string }> };

export default async function MyPlanDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/plan-finder/${id}`);
}
