import { MyPlanNewForm } from './MyPlanNewForm';

export default function MyPlanNewPage() {
  return (
    // 0527: 페이지 제목은 MyPlanNewForm이 담당(수정 화면과 공용 — 그쪽엔 제목이 없던 비대칭 해소)
    // 0536: 입출력 화면 공용 폭 --reading-w(860) — 폭 규칙 2원칙. 0527 조판 성립 검산:
    //   2열 필드 (860−18)/2=421 / 3열 [1fr_1fr_140px] 1fr=342 / 항공 구간 최소 480(+wrap 안전망)
    //   / 고정비용 1fr=522 / 비용 카테고리 2열 402 — 전부 성립, 조판 무변.
    //   수정 화면([id]/edit)도 같은 폼이라 같은 래퍼 — 한쪽만 바꾸면 폭이 어긋난다.
    <div className="max-w-[var(--reading-w)] mx-auto">
      <MyPlanNewForm />
    </div>
  );
}
