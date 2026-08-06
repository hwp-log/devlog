import { MyPlanNewForm } from './MyPlanNewForm';

export default function MyPlanNewPage() {
  return (
    // 0527: 페이지 제목은 MyPlanNewForm이 담당(수정 화면과 공용 — 그쪽엔 제목이 없던 비대칭 해소)
    <div>
      <MyPlanNewForm />
    </div>
  );
}
