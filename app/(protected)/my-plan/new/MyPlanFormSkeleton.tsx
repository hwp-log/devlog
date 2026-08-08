// 0571: 플랜 작성·수정 진입 로딩 스켈레톤 — my-plan/new·my-plan/[id]/edit가 같은 MyPlanNewForm을
//   쓰고 페이지 제목 치수도 동일해 1벌 공유. 두 loading.tsx가 이 컴포넌트를 렌더(0491 구조 그대로).
//
// 만든 이유: 두 라우트에 loading.tsx가 없어 상위 my-plan/loading.tsx(목록용)가 fallback으로
//   떴다 — 폼으로 들어가는데 아바타·검색바·카드 12장 그리드가 스치고, 폭까지 풀블리드→860으로
//   바뀌었다. 0491이 story/[id]/edit에 자체 loading을 만든 사유("상세 스켈레톤이 edit fallback으로
//   뜨던 것")와 같은 유형의 두 번째 발생.
//
// §11 갈래: 실물로 남길 게 한두 줄이 아니라 **골격 전체 shimmer**. 섹션 제목("기본 정보" 등)도
//   회색 블록 — 크롬 예외(0413 정적 눈썹·타이틀)에 해당하는 요소가 이 폼엔 없다.
// 선 처리(0542): SectionHeader의 2px section-rule은 **투명 보더로 자리만 유지**(강조선은 로딩보다
//   먼저 뜨면 "뼈대 선행 표시" 기각 사유가 재발). 지표 밴드의 border-border·입력 테두리
//   field-border·hairline은 **실색** — 위계가 아니라 면 분할이라 로딩 중에도 영역 구조를 잡는다.
//
// 생략(조건부 — §11 "드묾·뷰포트 밖·소유자 조건부는 생략"):
//   - 여행 일정 Day 탭 / "N일차 항목 추가" 버튼: hasDays 조건. **new 대표형은 기간 미설정**
//   - 예상 비용 요약(총액·누적 막대·카테고리 격자): 0570부터 전부 0이면 CostSection이 null을
//     반환한다 — new 대표형은 "안 뜸". (지표 밴드는 반대로 값이 없어도 "—"로 항상 떠서 포함)
//   - 항공권 검색 결과·일자별 비용 입력 행: 조건부
//   - 모바일 고정 저장 바(sm:hidden fixed): 스켈레톤이 그리면 실화면 바와 겹친다
//
// 치수는 실화면 리터럴 준용 — **한쪽만 바꾸면 스켈레톤이 어긋난다**. 짝은 MyPlanNewForm의
//   같은 블록(제목 h1 / 지표 밴드 / SectionHeader / INPUT_CLASS / 빈 상태 / CostGroupHeader).
//   줄높이 산식(§11): text-base 등 Tailwind 폰트 유틸은 lh 내장(16px→24px), text-[26px] 같은
//   arbitrary는 lh 상속(1.5) — 바를 실물 줄높이 박스 안에 넣어야 시프트가 없다.
export function MyPlanFormSkeleton() {
  return (
    // 폭 래퍼를 스켈레톤이 직접 갖는다 — loading.tsx는 page.tsx의 래퍼 **밖**에서 뜨므로
    // 여기 없으면 로딩만 전폭이 된다(§11 확인 순서 2: 폭은 §10 갈래·토큰 그대로).
    // max-sm:pb-[88px]은 실화면 짝(모바일 고정 저장 바 가림 방지).
    <div className="max-w-[var(--reading-w)] mx-auto max-sm:pb-[88px]" aria-hidden>
      {/* 페이지 제목 h1 — text-[26px] sm:text-[28px] arbitrary → lh 1.5 = 39/42px 박스 */}
      <div className="flex h-[39px] items-center sm:h-[42px]">
        <div className="h-6 w-40 rounded skeleton-shimmer sm:h-7" />
      </div>

      {/* 지표 밴드 4칸 — 실화면과 같은 grid·py·border·정렬. 라벨 11/12px, 값 16/20px.
          값이 없어도 "—"로 항상 뜨는 블록이라 조건부가 아니다(생략 대상 아님).
          0574: 모바일 2×2 균등 + sm+ 4열 균등, 마지막 칸만 sm+ 우측 정렬. */}
      <div className="mt-[14px] grid grid-cols-2 gap-x-2 gap-y-3 border-t border-b border-border py-[14px] sm:mt-[22px] sm:grid-cols-4 sm:gap-y-0 sm:py-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={
              i === 3
                ? 'flex flex-col gap-[3px] sm:gap-1 sm:items-end'
                : 'flex flex-col gap-[3px] sm:gap-1'
            }
          >
            {/* 라벨 text-[11px] lh 1.5 = 16.5px / sm:text-xs lh 16px */}
            <div className="flex h-[17px] items-center sm:h-4">
              <div className="h-2.5 w-8 rounded skeleton-shimmer" />
            </div>
            {/* 값 text-base lh 24px / sm:text-xl lh 28px */}
            <div className="flex h-6 items-center sm:h-7">
              <div className="h-4 w-16 rounded skeleton-shimmer sm:h-5" />
            </div>
          </div>
        ))}
      </div>

      <SectionHeaderSkeleton className="mt-[26px] sm:mt-[38px]" />

      {/* 제목 필드 — FIELD_CLASS(gap-[5px]) + INPUT_CLASS 높이 52px(py-13×2 + lh24 + border2) */}
      <div className="mt-[18px] flex flex-col gap-[5px] sm:mt-[22px]">
        <FieldLabelSkeleton />
        <InputSkeleton />
      </div>

      {/* 출발일·도착일 — 360px에선 1열 */}
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-[5px]">
            <FieldLabelSkeleton />
            <InputSkeleton />
          </div>
        ))}
      </div>

      {/* 지역·영화·인원수 — sm+에서 [1fr_1fr_140px] */}
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] sm:grid-cols-[1fr_1fr_140px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-[5px]">
            <FieldLabelSkeleton />
            <InputSkeleton />
          </div>
        ))}
      </div>

      {/* 간단소개 textarea — rows=3 × leading-[1.7] = 81.6px + py-13×2 + border2 ≈ 110px */}
      <div className="mt-[18px] flex flex-col gap-[5px]">
        <FieldLabelSkeleton />
        <div className="h-[110px] rounded-lg border border-field-border p-[14px]">
          <div className="h-4 w-full rounded skeleton-shimmer" />
          <div className="mt-2 h-4 w-[88%] rounded skeleton-shimmer" />
        </div>
      </div>

      <SectionHeaderSkeleton className="mt-[26px] sm:mt-11" />

      {/* 여행 일정 빈 상태 — new 대표형(기간 미설정이라 Day 탭·추가 버튼 없음).
          실화면 짝: py-[34px] + gap-2.5, 15px(lh 1.5=22.5)·14px(text-sm lh 20) 2단 */}
      <div className="mb-4">
        <div className="flex flex-col items-center gap-2.5 border-b border-hairline py-[34px]">
          <div className="flex h-[23px] items-center">
            <div className="h-4 w-36 rounded skeleton-shimmer" />
          </div>
          <div className="flex h-5 items-center">
            <div className="h-3.5 w-64 max-w-full rounded skeleton-shimmer" />
          </div>
        </div>
      </div>

      <SectionHeaderSkeleton className="mt-[26px] sm:mt-11" />

      {/* 비용 그룹 헤더 3개(항공권 / 고정 / 일자별) — CostGroupHeader 짝:
          mt-7 pt-2.5 border-t border-fg/15 + 내부 mt-2.5, 점 6px + 제목 15px(lh 1.5=22.5).
          0568: 순서는 항공권 먼저 — 스켈레톤은 제목을 안 그리므로 순서가 형태에 안 나타나지만,
          그룹 수(3)와 간격은 실화면과 짝이다. */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-7 border-t border-fg/15 pt-2.5">
          <div className="mt-2.5 flex h-[23px] items-center">
            <div className="mr-[9px] h-1.5 w-1.5 shrink-0 rounded-[3px] skeleton-shimmer" />
            <div className="h-4 w-28 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}

      {/* 데스크톱 저장 버튼 — py-4 + text-base lh24 = 56px. 모바일은 고정 바(생략)가 담당 */}
      <div className="mt-9 hidden h-14 rounded-lg skeleton-shimmer sm:block" />

      {/* ← 목록으로 */}
      <div className="mt-7 flex h-5 items-center">
        <div className="h-3.5 w-20 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

// SectionHeader 짝 — 2px section-rule은 **투명**(0542: 강조선은 로딩 중 숨김, 자리만 유지).
// 제목 text-[20px] sm:text-[22px] arbitrary → lh 1.5 = 30/33px.
function SectionHeaderSkeleton({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="flex items-baseline border-b-2 border-transparent pb-2 sm:pb-2.5">
        <div className="flex h-[30px] items-center sm:h-[33px]">
          <div className="h-5 w-28 rounded skeleton-shimmer sm:h-6" />
        </div>
      </div>
    </div>
  );
}

// LABEL_CLASS = text-xs(lh 16px)
function FieldLabelSkeleton() {
  return (
    <div className="flex h-4 items-center">
      <div className="h-2.5 w-12 rounded skeleton-shimmer" />
    </div>
  );
}

// INPUT_CLASS 높이 = py-[13px]×2 + text-base lh 24 + border 1px×2 = 52px.
// 테두리는 실색 — 터치 경계(면 분할)라 로딩 중에도 입력 자리를 잡아준다.
function InputSkeleton() {
  return <div className="h-[52px] rounded-lg border border-field-border" />;
}
