// 0572: 어드민(작품 관리) 진입 로딩 — route-level fallback.
//
// 0571(플랜 작성·수정)과 증상이 달랐다: 그쪽은 상위 my-plan/loading(목록용)이 **엉뚱한 골격**으로
//   떴고, 여기는 app/·app/(protected)/ 어디에도 loading.tsx가 없어 **아무것도 안 떴다**
//   (Suspense 경계 자체가 안 생겨 응답이 올 때까지 이전 화면에 머문다).
// ── 실제 노출 구간: page 조회 ~44.9ms뿐 (빠른 환경에선 거의 안 보인다) ──────
// loading.tsx는 **layout 안쪽**이다(Next 16 loading.md: "In the same folder, loading.js will be
//   nested inside layout.js"). 구성은 <AdminLayout>→<Suspense fallback={이 파일}>→<AdminPage>라
//   **AdminLayout이 await하는 동안에는 경계가 아직 없어 스켈레톤이 못 뜬다.**
//   그 앞에 app/(protected)/layout.tsx(auth + user.findUnique)의 대기도 더 붙는다.
//
//   실측(워밍업 후 7회, Supabase ap-northeast-1):
//     [(protected) auth] → [admin layout 권한 조회 45.8ms] → ★여기부터 스켈레톤★ → [page 44.9ms]
//   즉 **덮이는 건 뒤쪽 ~44.9ms뿐**이고 60fps 기준 2~3프레임이다.
//   → 데이터가 적고 회선이 빠른 조건에서 거의 안 보이는 것이 **정상**이다. 결함이 아니라
//     "기다릴 구간이 짧다"는 사실의 반영.
//   → 승인 대기가 쌓이면 page의 findMergeCandidates가 대기 1건당 1회 돌아 이 구간이 길어지고,
//     그때 제 역할을 한다(page = movie.findMany 2종 Promise.all + 후보 조회 N회).
//
//   덮이지 않는 앞 구간을 없애려면 app/(protected)/loading.tsx가 필요한데, 그건 (protected)
//   **전 화면에 영향**을 주는 변경이라 별도 판단으로 뺐다(백로그). 권한 게이트를 layout에서
//   page로 내리는 안은 **보안 구조를 로딩 UI 때문에 바꾸는 것**이라 채택하지 않는다.
//
// §11 갈래: 실물로 남길 게 한두 줄이 아니라 **골격 전체 shimmer**. 눈썹("Admin")·h1("작품 관리")도
//   회색 블록 — my-plan/loading(0542)이 눈썹까지 shimmer로 둔 선례와 같다.
//
// 대표형(§11):
//   - 승인 대기 **행은 생략**, 섹션 헤더만. 조사 시점 실데이터가 PENDING 0건이고, 승인 대기는
//     처리되면 사라지는 성격이라 "없음"이 지배적 대표형이다. **데이터가 늘면 재검토 대상.**
//   - 승인됨 행 3개 — APPROVED 17건이 지배적 대표형(뷰포트에 들어오는 몫만).
//   - 생략(조건부): 병합 후보 칩(candidates.length > 0) · 인라인 수정 입력(editing).
//
// ── glass-outer를 쓰는 이유와 유효 기간 ──────────────────────────────────
// 스켈레톤은 실화면의 **짝**이지 개선안이 아니다. 실화면 섹션이 glass-outer(카드 면·그림자)를
// 쓰므로 여기서도 쓴다 — 안 쓰면 전환 시 카드 면이 갑자기 생긴다.
// **실화면이 이 유틸을 쓰는 동안만 유효 — 어드민 토큰 이전 시 함께 바꿀 것.**
//
// ── 알고 남기는 역전 (다음에 어드민 다크를 볼 때의 단서) ──────────────────
// 이 화면은 토큰 이전에서 빠진 유일한 화면이다: text-[#1A1A1A] / text-slate-* / divide-black/5 /
// border-slate-200 / glass-outer / btn-elevated 전부 하드코딩. 다른 화면이 0524~0527에서
// fg·fg2·muted·border 토큰으로 옮길 때 여기만 남았다.
// 그래서 **스켈레톤(토큰 기반)은 다크에서 정상인데 콘텐츠가 오면 깨지는 역전**이 생길 수 있다
// — 흰 카드에 #1A1A1A 글자가 고정이라. 스켈레톤 탓이 아니라 실화면 탓이고, 어드민 토큰 이전
// 사이클에서 함께 해소한다(백로그 등재).
//
// 치수는 실화면 리터럴 준용 — **한쪽만 바꾸면 스켈레톤이 어긋난다**. 짝은 admin/page.tsx의
//   헤더·섹션 블록과 _components/ApprovedMovieRow의 행(p-6 + 2줄 좌 / 버튼 2개 우).
//   줄높이(§11): text-xs→16 / text-sm→20 / text-2xl→32 / md:text-3xl→36 (전부 유틸이라 lh 내장).
export default function Loading() {
  return (
    // 폭 래퍼는 스켈레톤이 직접 갖는다 — loading.tsx는 page.tsx 래퍼 **밖**에서 뜬다.
    // max-w/space-y는 page.tsx 짝(0536에서 구 max-w-3xl → --reading-w 편입).
    <div className="max-w-[var(--reading-w)] mx-auto space-y-8" aria-hidden>
      {/* 눈썹(text-xs lh16 + mb-1) + h1(text-2xl lh32 / md:text-3xl lh36) */}
      <div>
        <div className="h-4 mb-1 flex items-center">
          <div className="h-3 w-12 rounded skeleton-shimmer" />
        </div>
        <div className="h-8 md:h-9 flex items-center">
          <div className="h-6 md:h-7 w-40 rounded skeleton-shimmer" />
        </div>
      </div>

      {/* 승인 대기 — 헤더만(대표형 0건) */}
      <section className="glass-outer divide-y divide-black/5">
        <SectionHead />
      </section>

      {/* 승인됨 — 헤더 + 행 3개 */}
      <section className="glass-outer divide-y divide-black/5">
        <SectionHead />
        {[0, 1, 2].map((i) => (
          <Row key={i} />
        ))}
      </section>
    </div>
  );
}

// 섹션 헤더 짝 — p-6 + h2 text-sm(lh 20). 제목 옆 건수 span은 같은 줄이라 바 하나로 근사.
function SectionHead() {
  return (
    <div className="p-6">
      <div className="h-5 flex items-center">
        <div className="h-4 w-24 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

// ApprovedMovieRow 짝 — p-6 flex items-center justify-between gap-4.
//   좌: 제목 text-sm(lh20) + mt-1 메타 text-xs(lh16)
//   우: btn-elevated 2개(px-3 py-1.5 text-xs → 6+6+16 = 28px, rounded-full)
//   폭 54/100은 "수정"·"대기로 되돌리기" 글자수 근사(정확 일치 불가 — 글자 폭 의존).
function Row() {
  return (
    <div className="p-6 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="h-5 flex items-center">
          <div className="h-4 w-[45%] max-w-[220px] rounded skeleton-shimmer" />
        </div>
        <div className="h-4 mt-1 flex items-center">
          <div className="h-3 w-32 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="h-7 w-[54px] rounded-full skeleton-shimmer" />
        <div className="h-7 w-[100px] rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}
