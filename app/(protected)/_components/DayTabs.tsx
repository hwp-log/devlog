'use client';
import type { ReactNode } from 'react';

/**
 * 날짜 탭 — 가로 한 줄 pill 탭(선택=채움 / 나머지=테두리) + 모바일 우측 페이드.
 *
 * ── 산출 근거 (0565 추출) ────────────────────────────────────────────────
 * 0515에 PlanFinderDetail "여행 일정"에 인라인으로 들어간 조각을, 0565에서 같은
 * 화면 "여행 일자별 비용"이 같은 형태를 요구하며 추출했다. 클래스·구조는 0515
 * 원본 그대로 이관 — 이 커밋 시점 일정 탭의 렌더는 무변이다.
 *
 * 복제가 아니라 추출인 이유: 두 탭이 **같은 플랜의 같은 날짜**를 표시한다.
 * 형태가 갈리면 같은 날짜가 두 모양으로 보이고, 두 벌이면 다음 수정 때 한쪽만
 * 고치게 된다(0524 cat-* 토큰·0563 표시 언어 통일과 같은 판단).
 *
 * 위치가 app/(protected)/_components 인 이유: 호출부가 plan-finder/[id]/와
 * story/[id]/에 나뉘어 있어 어느 한쪽에 두면 역방향 의존이 생긴다(0562가
 * 슬롯으로 피해 갔던 그 문제). SectionHeader와 같은 자리.
 *
 * ── 알고 받는 결함 ───────────────────────────────────────────────────────
 * 탭 높이 ≈32~34px(px-4 py-1.5 + text-sm)로 CLAUDE.md §5 터치 타겟 44px에
 * 미달한다. 0565는 "일정 탭과 형태 동일"이 요구사항이고 일정 섹션 변경은
 * 범위 밖이라, 승격하면 두 탭이 갈린다. 두 탭을 **동시에** 44px로 올리는 건
 * 접근성 결함 정리 사이클 몫(작품 칩 11px·지표 밴드 라벨 11px과 같은 묶음).
 * 여기만 먼저 고치지 말 것 — 형태 통일이 이 컴포넌트의 존재 이유다.
 */
export function DayTabs({
  days,
  selected,
  onSelect,
  label,
  right,
}: {
  days: number[];
  selected: number;
  onSelect: (day: number) => void;
  /** 탭 문안 — 호출부가 startDate 유무·폴백을 정한다(화면마다 폴백 어휘가 다름) */
  label: (day: number) => string;
  /**
   * 탭 줄 오른쪽 고정 영역 — 0565 비용 섹션의 "그날 소계" 전용(일정은 미사용).
   * 스크롤 컨테이너 **밖**의 형제라 탭이 넘쳐도 같이 밀리지 않는다.
   */
  right?: ReactNode;
}) {
  return (
    // 0515: 모바일 날짜 탭 — 전폭 한 줄 가로 스크롤 + 오른쪽 페이드(시안 4d). 데스크톱은 기존 그대로.
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 max-sm:pr-6">
          {days.map((d) => (
            <button
              key={d}
              onClick={() => onSelect(d)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${
                selected === d
                  ? 'bg-fg text-bg'
                  : 'bg-card border border-border text-fg2 hover:bg-surface2'
              }`}
            >
              {label(d)}
            </button>
          ))}
        </div>
        {/* 페이드는 스크롤 영역의 오른쪽 끝 — right 슬롯이 있으면 소계 앞에서 끝난다 */}
        <div
          aria-hidden
          className="sm:hidden absolute right-0 top-0 bottom-1 w-[34px] bg-gradient-to-r from-transparent to-bg pointer-events-none"
        />
      </div>
      {right}
    </div>
  );
}
