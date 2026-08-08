// 0571: 새 계획 진입 로딩 — 상위 my-plan/loading(목록용 카드 그리드)이 fallback으로 뜨던 것을
// 해소. 골격은 수정 화면과 공유(MyPlanFormSkeleton).
//
// ── 현재 이 파일은 화면에 그려지지 않는다 ────────────────────────────────
// loading.tsx는 세그먼트를 <Suspense>로 감싸고 **그 경계가 pending인 동안만** 대체 UI를
// 그린다(Next 16 loading.md: "while the content of a route segment streams in").
// 그런데 이 라우트의 page.tsx는 **sync 함수 + 서버 조회 0**이라 서버가 한 번의 플러시로
// 완성된 페이로드를 내보낸다 — 경계가 pending으로 머무는 구간이 없어 fallback이 그려질 창이
// 없다. (짝인 [id]/edit은 async + Prisma 조회 131ms 실측이라 정상적으로 그려진다.)
//
// ── 그래도 지우지 않는 이유 ──────────────────────────────────────────────
// ① 지우면 상위 my-plan/loading(목록용)이 다시 fallback이 된다 — 폼으로 들어가는데 아바타·
//    검색바·카드 12장이 스치고 폭까지 풀블리드로 갈리던 0571의 문제가 그대로 되살아난다.
// ② 지금 조회가 없을 뿐이다. 서버 조회가 생기면(담기·복제 경로, 초기값 서버 조회 등)
//    **그때부터 자동으로 동작한다.** 그 시점에 파일이 없으면 같은 결함을 다시 만든다.
// 로딩 UI를 보이게 하려고 page를 async로 바꾸거나 인위 지연을 넣지 않는다 — 앞은 본말전도고
// 뒤는 §11 금지(0489 안티패턴).
import { MyPlanFormSkeleton } from './MyPlanFormSkeleton';

export default function Loading() {
  return <MyPlanFormSkeleton />;
}
