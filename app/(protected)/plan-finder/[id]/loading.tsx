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

        {/* 지표 밴드 — 실화면 밴드와 열 분배·mt·py·border·정렬 동일.
            0574: 모바일 2×2 균등 + sm+ 4열 균등. 구 "모바일 비균등(앞 3칸 auto + 총 비용 1fr)"
            준용은 폐기 — 균등 트랙에선 셔머 바 폭이 트랙을 결정하지 않으므로, 아래 w-* 는
            **트랙 결정용이 아니라 값 길이 근사**로만 남는다(기간 55·장소 34·인원 24·금액 96). */}
        <div className="mt-[14px] sm:mt-[22px] grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3 sm:gap-y-0 py-[14px] sm:py-5 border-t border-b border-border">
          {[
            { label: 'w-8', value: 'w-[55px]' },
            { label: 'w-8', value: 'w-[34px]' },
            { label: 'w-8', value: 'w-6' },
            { label: 'w-12', value: 'w-24' },
          ].map((w, i) => (
            // 0574: 마지막 칸만 sm+ 우측 정렬 — 실화면 짝(총 비용)
            <div
              key={i}
              className={
                i === 3
                  ? 'flex flex-col gap-[3px] sm:gap-1 sm:items-end'
                  : 'flex flex-col gap-[3px] sm:gap-1'
              }
            >
              <div className={`h-3.5 sm:h-4 rounded skeleton-shimmer ${w.label}`} />
              <div className={`h-6 sm:h-7 rounded skeleton-shimmer ${w.value}`} />
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
          {/* 카테고리 대표 4칸 — 2열 조판(0517)이 드러나는 최소 짝수.
              0567 ⑭: 실화면이 3px 세로 막대 → 7px 점으로 바뀌었으나 스켈레톤은 무변 —
              점(7px)은 셔머로 그리기엔 너무 작아 §11 "작은 요소는 표현에서 뺀다"에 해당하고,
              구 막대도 스켈레톤엔 없었다(행 높이 py-2는 그대로라 시프트 없음). */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="h-4 w-16 rounded skeleton-shimmer" />
                <div className="h-4 w-20 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
          {/* 접기 그룹 헤더 3줄 — GroupHeader 짝. 기본 접힘이라 제목 줄만(항목 행 없음).
              0562: 2 → 3줄 — 항공이 독립 섹션에서 비용의 형제 그룹으로 편입되며 그룹이 하나 늘었다
              (항공권 / 고정 비용 / 일자별 비용). 대표형 "전부 있음"은 §11대로 유지.
              0567: 여백 골격 동기 — 실화면이 GROUP_MT(첫 그룹 mt-4 / 이후 mt-1.5 + pt-2.5 +
              mt-2.5)에서 [구분선 + 위 22px + 아래 16px] 한 규칙으로 통일됐다. 여기만 구 값이면
              로딩→콘텐츠 전환에 그룹마다 세로 시프트가 생긴다.
              0567 후속③: 요약↔첫 그룹 40px(mt-10) — 실화면이 요약과 상세를 이 간격 하나로
              가른다. 래퍼에 주는 것도 실화면과 같다(첫 그룹이 데이터에 따라 바뀌므로).
              **한쪽만 바꾸면 어긋남** — 짝은 PublicCostSection의 그룹 래퍼 mt-10 ·
              GROUP_WRAP(pb-4) · GroupHeader mt-[22px]. */}
          <div className="mt-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="pb-4">
                <div className="border-t border-fg/15" />
                <div className="mt-[22px] flex items-center py-1.5">
                  <div className="h-[21px] w-40 rounded skeleton-shimmer" />
                  <div className="ml-auto h-4 w-4 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 0562: 구 "왕복 항공편" 섹션 골격 삭제 — 항공은 비용의 접기 그룹으로 편입됐고,
          그룹은 기본 접힘이라 로딩 중 노선표가 드러나지 않는다(위 그룹 헤더 3줄이 그 짝). */}
    </div>
  );
}
