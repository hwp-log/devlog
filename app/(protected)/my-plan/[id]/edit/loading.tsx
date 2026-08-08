// 0571: 계획 수정 진입 로딩 — 상위 my-plan/loading(목록용)이 fallback으로 뜨던 것을 해소.
// 골격은 새 계획과 공유(MyPlanFormSkeleton). edit 자체 loading이 상위 loading보다 우선.
// 이쪽은 실제 서버 조회(plan findFirst + spots·costs·flight include)가 있어 노출이 길다.
import { MyPlanFormSkeleton } from '@/app/(protected)/my-plan/new/MyPlanFormSkeleton';

export default function Loading() {
  return <MyPlanFormSkeleton />;
}
