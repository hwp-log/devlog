// 0571: 새 계획 진입 로딩 — 자체 loading으로 상위 my-plan/loading(목록용 카드 그리드)이
// fallback으로 뜨던 것을 해소. 골격은 수정 화면과 공유(MyPlanFormSkeleton).
// 이 라우트는 서버 조회가 없어(page.tsx 동기 + 클라 폼) 노출이 짧다 — 그래도 두는 이유는
// 짧게 스치는 게 **엉뚱한 골격**이면 안 되기 때문이다(문제의 본질은 길이가 아니라 형태).
import { MyPlanFormSkeleton } from './MyPlanFormSkeleton';

export default function Loading() {
  return <MyPlanFormSkeleton />;
}
