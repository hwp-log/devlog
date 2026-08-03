// 0490: 스토리 상세 진입 로딩 스켈레톤 — 상세 라우트가 무방비(클릭 후 2~3초 무피드백)라 route-level
// fallback으로 즉시 표시. 실제 story/[id] 골격 준용(A-1): 눈썹·제목·메타·본문 + 방문장소 지도 블록.
// 생략: PLAN 카드·태그·하단 버튼(조건부/하단), 메타의 수정·삭제 아이콘(isOwner 조건부라 남의 글에서 어긋남).
// skeleton-shimmer 유틸 재사용(새 애니메이션 없음). 폭은 상세와 공유하는 --story-content-w(860).
// 주의: 이 loading.tsx는 하위 [id]/edit 내비의 fallback으로도 적용됨 — edit 전용 스켈레톤은 별건.
export default function Loading() {
  return (
    <div className="max-w-[var(--story-content-w)] mx-auto" aria-hidden>
      {/* 눈썹 STORY */}
      <div className="h-3 w-16 rounded skeleton-shimmer" />
      {/* 제목 */}
      <div className="mt-[6px] mb-6">
        <div className="h-8 w-[70%] rounded skeleton-shimmer" />
      </div>
      {/* 메타 — 아바타·이름·세로 파이프·날짜 (수정·삭제 아이콘 자리 없음) */}
      <div className="mt-[14px] pb-[16px] border-b border-border mb-6 flex items-center gap-[10px]">
        <div className="w-6 h-6 rounded-full skeleton-shimmer" />
        <div className="h-3 w-24 rounded skeleton-shimmer" />
        <span aria-hidden className="w-px h-[11px] bg-border" />
        <div className="h-3 w-20 rounded skeleton-shimmer" />
      </div>
      {/* 본문 — 높이 가변·공유 상수 없음 → 대표 문단 라인 바 */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="h-4 w-full rounded skeleton-shimmer" />
        <div className="h-4 w-full rounded skeleton-shimmer" />
        <div className="h-4 w-[85%] rounded skeleton-shimmer" />
        <div className="mt-3 h-4 w-full rounded skeleton-shimmer" />
        <div className="h-4 w-[95%] rounded skeleton-shimmer" />
        <div className="h-4 w-[70%] rounded skeleton-shimmer" />
        <div className="mt-3 h-4 w-full rounded skeleton-shimmer" />
        <div className="h-4 w-[80%] rounded skeleton-shimmer" />
      </div>
      {/* 방문장소 — h2 + 지도 블록. h-[400px] md:h-[500px] = SpotMap 지도 높이 준용
          (SpotMap.tsx 리터럴과 짝 — 한쪽만 바꾸면 스켈레톤이 어긋남) */}
      <div className="mt-[46px]">
        <div className="mb-[16px] h-6 w-28 rounded skeleton-shimmer" />
        <div className="h-[400px] md:h-[500px] w-full rounded-[var(--radius-base)] skeleton-shimmer" />
      </div>
    </div>
  );
}
