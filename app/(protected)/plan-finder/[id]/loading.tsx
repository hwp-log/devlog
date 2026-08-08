// 0490: 플랜파인더 상세 진입 로딩 스켈레톤 — 상세 라우트 무방비(2~3초 무피드백) 해소용 route-level fallback.
// 0538: 0512~0536 실화면 개편(폭 860·히어로·지표 밴드·섹션 헤더·행 목록·비용·항공)에 재동기.
//   구조 클래스(폭·높이·마진)는 PlanFinderDetail.tsx / PublicCostSection.tsx의 해당 블록과 짝 —
//   **한쪽만 바꾸면 스켈레톤→실콘텐츠 전환 시 시프트가 생긴다** (각 블록 주석에 짝 명시).
//   조건부 요소(커버·소개문·비용)는 데이터를 모르므로 "공개 플랜 대표형 = 전부 있음"으로 고정.
// 0562: 섹션이 셋(일정·비용) → 둘로 — 항공이 독립 섹션에서 비용의 접기 그룹으로 편입됐다.
//   PublicFlightTable은 접힌 그룹 안이라 더 이상 이 스켈레톤의 짝이 아니다.
//   skeleton-shimmer 유틸 재사용(새 애니메이션 없음).

// 섹션 헤더 골격 — PlanFinderDetail SectionHeader 짝(22px 제목 + 2px 실선 + 우측 보조).
// 0542: 2px 강조선은 로딩 중 숨김(§11 승격 규칙) — 투명 보더로 자리 유지, 시프트 없음.
function SectionHeaderSkeleton() {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-transparent pb-2 sm:pb-2.5">
      <div className="h-6 sm:h-7 w-28 rounded skeleton-shimmer" />
      <div className="h-4 w-24 rounded skeleton-shimmer" />
    </div>
  );
}

export default function Loading() {
  return (
    // 폭: 실화면 래퍼와 동일 토큰(--reading-w = 860, 0534) — 갈리면 좌우 정렬선이 튄다.
    <div aria-hidden className="max-w-[var(--reading-w)] mx-auto">
      {/* 히어로 — PlanFinderDetail 커버 블록 짝(h-200/300 rounded-[14px] mb-4) */}
      <div className="h-[200px] sm:h-[300px] rounded-[14px] mb-4 skeleton-shimmer" />

      <div className="mb-6">
        {/* 메타 행 — 아바타 → 닉네임 → 날짜, 우측 액션(좋아요는 항상 노출) */}
        <div className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full skeleton-shimmer" />
            <div className="h-3.5 w-16 rounded skeleton-shimmer" />
            <div className="h-3.5 w-20 rounded skeleton-shimmer" />
          </div>
          <div className="h-8 w-16 shrink-0 rounded-full skeleton-shimmer" />
        </div>

        {/* 지표 밴드 3열(기간·장소·총 비용) — 실화면 밴드와 mt·py·border 동일 */}
        <div className="mt-[14px] sm:mt-[22px] grid grid-cols-3 gap-x-2 py-[14px] sm:py-5 border-t border-b border-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-[3px] sm:gap-1">
              <div className="h-3.5 sm:h-4 w-10 rounded skeleton-shimmer" />
              <div className="h-6 sm:h-7 w-20 rounded skeleton-shimmer" />
            </div>
          ))}
        </div>

        {/* 소개문 — 대표형 2줄 */}
        <div className="mt-[14px] sm:mt-[22px] flex flex-col gap-2">
          <div className="h-4 rounded skeleton-shimmer" />
          <div className="h-4 w-[70%] rounded skeleton-shimmer" />
        </div>
      </div>

      {/* 여행 일정 */}
      <div className="mt-4">
        <SectionHeaderSkeleton />
      </div>
      {/* Day 탭 — 대표 3개(2박3일). 실탭은 px-4 날짜 라벨이라 구 w-16보다 넓은 72px */}
      <div className="mt-4 mb-6 flex gap-1.5 sm:gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-[72px] rounded-full skeleton-shimmer" />
        ))}
      </div>
      {/* 일정 행 4개 — 실행(py + 60px 썸네일 + hairline)과 동일 골격. 카드 아님(0513) */}
      <div className="flex flex-col">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 sm:gap-3 py-[13px] sm:py-[14px] border-b border-hairline"
          >
            <div className="w-[22px] shrink-0">
              <div className="h-4 w-3 rounded skeleton-shimmer" />
            </div>
            <div className="w-[60px] h-[60px] shrink-0 rounded-[10px] skeleton-shimmer" />
            <div className="flex flex-col gap-[5px] sm:gap-1 flex-1">
              <div className="h-4 sm:h-5 w-32 rounded skeleton-shimmer" />
              <div className="h-3.5 w-48 max-w-full rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* 예상 비용 — PublicCostSection 짝: 총액 26px → 누적 막대 h-3 → 카테고리 2열 → 접기 헤더 2줄(기본 접힘 = 제목 줄만) */}
      <div className="mt-7 sm:mt-11">
        <SectionHeaderSkeleton />
        <div className="mt-[18px]">
          <div className="h-8 w-40 rounded skeleton-shimmer" />
          <div className="mt-3 h-3 rounded-md skeleton-shimmer" />
          {/* 카테고리 대표 4칸 — 2열 조판(0517)이 드러나는 최소 짝수 */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="h-4 w-16 rounded skeleton-shimmer" />
                <div className="h-4 w-20 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
          {/* 접기 그룹 헤더 3줄 — GroupHeader 짝(pt-2.5 + 구분선 + mt-2.5 필 py-1.5). 항목 행 없음.
              0562: 2 → 3줄 — 항공이 독립 섹션에서 비용의 형제 그룹으로 편입되며 그룹이 하나 늘었다
              (고정 비용 / 항공권 / 일자별 비용). 대표형 "전부 있음"은 §11대로 유지. */}
          {[0, 1, 2].map((i) => (
            <div key={i} className={i === 0 ? 'mt-4 pt-2.5' : 'mt-1.5 pt-2.5'}>
              <div className="border-t border-fg/15" />
              <div className="mt-2.5 flex items-center py-1.5">
                <div className="h-[21px] w-40 rounded skeleton-shimmer" />
                <div className="ml-auto h-4 w-4 rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 0562: 구 "왕복 항공편" 섹션 골격 삭제 — 항공은 비용의 접기 그룹으로 편입됐고,
          그룹은 기본 접힘이라 로딩 중 노선표가 드러나지 않는다(위 그룹 헤더 3줄이 그 짝). */}
    </div>
  );
}
