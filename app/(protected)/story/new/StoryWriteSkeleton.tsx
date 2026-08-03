// 0491: 글쓰기·수정 진입 로딩 스켈레톤 — story/new·story/[id]/edit가 같은 StoryWriteForm을 쓰고
// 페이지 헤더(눈썹+헤딩) 치수도 동일해 1벌 공유(C-1). 두 loading.tsx가 이 컴포넌트를 렌더.
// 실제 골격 준용: 눈썹·헤딩·제목·본문(에디터 상자=툴바+영역)·방문장소·태그·버튼.
// 생략(조건부): PLAN 블록(availablePlans>0, C-2)·태그 pills·플랜 미리보기 카드.
// skeleton-shimmer 재사용(새 애니메이션 없음). 폭은 상세와 공유하는 --story-content-w(860).
// 131/260/400·500은 실제 리터럴 준용(C-4 — TiptapEditor 툴바 max-sm:h-[131px]·EditorContent
// min-h-[260px]·SpotMap h-[400px] md:h-[500px]와 짝. 한쪽만 바꾸면 스켈레톤이 어긋남).
export function StoryWriteSkeleton() {
  return (
    <div className="max-w-[var(--story-content-w)] mx-auto" aria-hidden>
      {/* 눈썹 (WRITE/EDIT) */}
      <div className="h-3 w-16 rounded skeleton-shimmer" />
      {/* 헤딩 */}
      <div className="mt-[7px] mb-6 h-6 w-[65%] rounded skeleton-shimmer" />

      {/* 제목 */}
      <div className="flex flex-col">
        <div className="mb-[9px] h-3 w-10 rounded skeleton-shimmer" />
        <div className="border-b border-border pb-[10px]">
          <div className="h-7 w-[55%] rounded skeleton-shimmer" />
        </div>
      </div>

      {/* 본문 — 에디터 상자(툴바 + 영역) */}
      <div className="flex flex-col pt-[46px]">
        <div className="mb-[9px] h-3 w-10 rounded skeleton-shimmer" />
        <div className="rounded-[10px] border border-border">
          {/* 툴바 — 모바일 131px 3×2 그리드 / 데탑 flex-wrap (TiptapEditor 준용) */}
          <div className="border-b border-border max-sm:h-[131px]">
            <div className="flex flex-wrap gap-1 p-2 max-sm:grid max-sm:h-full max-sm:grid-cols-3 max-sm:grid-rows-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 w-14 rounded skeleton-shimmer max-sm:h-auto max-sm:w-auto" />
              ))}
            </div>
          </div>
          {/* 본문 영역 — min-h-[260px] */}
          <div className="flex min-h-[260px] flex-col gap-3 py-3 pl-4 pr-4 sm:pl-[38px]">
            <div className="h-4 w-full rounded skeleton-shimmer" />
            <div className="h-4 w-[92%] rounded skeleton-shimmer" />
            <div className="h-4 w-full rounded skeleton-shimmer" />
            <div className="h-4 w-[70%] rounded skeleton-shimmer" />
            <div className="h-4 w-[85%] rounded skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* 방문장소 — h2 + 지도 블록 */}
      <div className="w-full pt-[46px]">
        <div className="mb-[16px] h-6 w-28 rounded skeleton-shimmer" />
        <div className="h-[400px] w-full rounded-[var(--radius-base)] skeleton-shimmer md:h-[500px]" />
      </div>

      {/* 태그 — label + 입력 자리(border-b) */}
      <div className="flex flex-col pt-[46px]">
        <div className="mb-[9px] h-3 w-16 rounded skeleton-shimmer" />
        <div className="min-h-[44px] border-b border-border pb-[8px]" />
      </div>

      {/* 등록/수정 버튼 (BTN_PRIMARY = rounded-lg) */}
      <div className="pt-[46px]">
        <div className="h-11 w-full rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}
