'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { formatApproxCost } from '@/lib/plan/format-approx-cost';
import { formatDayLabel, addDays } from '@/lib/plan/format-day-label';

type ItemGroup = PublicCostSummary['itemGroups'][number];
type Item = ItemGroup['items'][number];

// 0505: 3열 항목 행 — [항목명 flex truncate] [카테고리 11px] [금액 우측]. 마지막 행만 아래 선 없음.
// 0506: last는 일자 묶음이 아니라 그룹(고정/일자별) 전체 기준 —
//   일자당 항목이 1개인 경우가 많아 묶음 기준이면 선이 거의 안 보임.
// 0506: 선 두께는 1px — 0.5px은 비레티나에서 0으로 반올림될 수 있음(globals.css 0345 실측 결정).
function ItemRow({
  item,
  currency,
  last,
  barClass,
}: {
  item: Item;
  currency: PublicCostSummary['currency'];
  last: boolean;
  // 0514: 카테고리 텍스트 라벨 대신 이름 왼쪽 3px 색 막대(시안 4a) — 색은 요약 rank와 동일 매핑.
  // 0516: border-left 방식이 실화면에서 무채로 떠 누적 막대와 동일한 bg 클래스 span으로 교체.
  barClass: string;
}) {
  // 항공 합성 항목은 '항공권'으로 표기(0505 목표3).
  const name = item.category === 'FLIGHT' ? '항공권' : item.label;
  return (
    <div
      className={`flex items-center py-[11px] text-sm${last ? '' : ' border-b border-[#f4f5f6]'}`}
    >
      <span aria-hidden className={`w-[3px] self-stretch shrink-0 ${barClass}`} />
      <span className="pl-2 pr-5 flex-1 min-w-0 text-fg2 truncate">{name}</span>
      <span className="shrink-0 font-semibold text-fg">{formatApproxCost(item.amount, currency)}</span>
    </div>
  );
}

// 0507: 접기 헤더 — 제목 줄 전체가 토글 버튼. 꺾쇠는 우측 끝, 접힘=아래·펼침=위(표준 아코디언).
// 0507 후속: 발견성 — 제목 줄에 무채 surface2 호버 필(데스크톱, v4 hover:는 hover 지원 기기만).
//   버튼을 좌우 8px 넓혀(-mx-2 + calc) 여백까지 히트. 구분선(mx-2)·제목(필 px-2)의 시각
//   x위치는 그대로 상쇄되고, 꺾쇠도 필 content 우측 끝 = 기존 위치.
//   터치 타겟: pt-2.5(10) + 선~필(mt-2.5=10) + 필(py-1.5+텍스트=32) = 52px(≥44, CLAUDE.md §5).
//   선 위치는 0505와 동일: 이전 내용 16px 아래(컨테이너 mt-1.5 + 버튼 pt-2.5).
function GroupHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group -mx-2 block w-[calc(100%+16px)] pt-2.5 text-left"
    >
      <span aria-hidden className="mx-2 block border-t border-fg/15" />
      {/* 0514: 제목 16px(시안 4a) — 간격 체계(0505·0507)는 유지 */}
      <span className="mt-2.5 flex items-center rounded-md px-2 py-1.5 text-base font-bold text-fg group-hover:bg-surface2">
        {title}
        <ChevronDown
          size={16}
          aria-hidden
          className={`ml-auto shrink-0 text-muted transition-transform${open ? ' rotate-180' : ''}`}
        />
      </span>
    </button>
  );
}

interface Props {
  summary: PublicCostSummary;
  headcount: number;
  // 0505: 일자 라벨용. null이면 일자 라벨을 "DAY N"으로 폴백.
  startDate: Date | null;
  endDate: Date | null;
}

// rank(비중 내림차순 index) → 색 클래스. 완전 리터럴만 JIT 스캔되므로 조합 금지 — 배열로 고정.
// rank6+(최대 6항목: 항공+카테고리 5종)는 Math.min으로 rank5 재사용(0343 확정).
const RANK_BAR = ['bg-chart1-bg', 'bg-chart2-bg', 'bg-chart3-bg', 'bg-chart4-bg', 'bg-chart5-bg'];

/**
 * 0492: 예산 요약 — 금액 공개. 총액 먼저 → 한 줄 누적 막대 → 항목별 금액 라벨.
 * (0343 트리맵·"공개 정책(금액 없음)"은 폐기 — 상세는 실금액을 "약 N만원"으로 노출.)
 * ratios는 summarizePlanCost가 비중 내림차순 정렬 보장 — index가 곧 rank(색 결정).
 * 금액은 계획 총액 기준(1인당 환산 없음 — 항목의 1인당/전체 구분이 없어 나누면 틀린 값, 0492 확정).
 * 소비처: plan-finder/[id]뿐(story/[id]·story/new는 요약 한 줄로 대체).
 */
export function PublicCostSection({ summary, headcount, startDate, endDate }: Props) {
  const { ratios, itemGroups, total, currency } = summary;
  // 0507: 두 층 각각 접기 — 기본 접힘. 카테고리 요약(막대·색 라벨)은 접기 대상 아님.
  const [fixedOpen, setFixedOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  if (ratios.length === 0) return null;

  // 0505: 두 층으로 분리 — 고정 비용(day=null: 항공권 + 무장소) / 일자별 비용(day 있는 그룹).
  //   summarize의 itemGroups 순서(항공 → 여행 전체 → Day)를 그대로 이어받아 항공권이 고정 맨 위.
  const fixedItems = itemGroups.filter((g) => g.day === null).flatMap((g) => g.items);
  const dayGroups = itemGroups.filter((g): g is ItemGroup & { day: number } => g.day !== null);
  // 0514: 항목 행 막대 색 — 요약 rank와 동일 매핑(카테고리 → rank 색). ratios 밖 카테고리는 무색.
  // 0516: 누적 막대와 완전히 동일한 RANK_BAR(bg) 클래스 재사용 — 색 값 왕복 제거의 정본 일치.
  const barByCategory = new Map(
    ratios.map((r, rank) => [r.category, RANK_BAR[Math.min(rank, 4)]]),
  );
  const barFor = (category: Item['category']) =>
    barByCategory.get(category) ?? 'bg-transparent';
  const periodLabel =
    startDate && endDate ? `${formatDayLabel(startDate)} ~ ${formatDayLabel(endDate)}` : null;
  const dayDateLabel = (day: number) =>
    startDate ? formatDayLabel(addDays(startDate, day - 1)) : `DAY ${day}`;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        {/* 0516: 총액 26px(시안 4a 실측) — 20px는 한 단 작게 들어간 오차 */}
        <span className="text-[26px] tracking-[-0.02em] font-bold text-fg">
          총 {formatApproxCost(total, currency)}
        </span>
        <span className="text-sm text-muted">· {headcount}인</span>
      </div>

      <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-surface2">
        {ratios.map((item, rank) => (
          <div
            key={item.category}
            style={{ flexGrow: item.ratio, flexBasis: 0 }}
            className={RANK_BAR[Math.min(rank, 4)]}
          />
        ))}
      </div>

      {/* 0514: 카테고리 색 = 이름 왼쪽 3px 막대(닷 제거) — 누적 막대 색과 이름의 한자리 대응.
          0517: 실화면 판정으로 2열 확정(sm:grid-cols-2 재복원, 좁아지면 1열). max-width 미적용. */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        {ratios.map((item, rank) => (
          <div key={item.category} className="flex items-center py-2">
            <span aria-hidden className={`w-[3px] self-stretch shrink-0 ${RANK_BAR[Math.min(rank, 4)]}`} />
            <span className="pl-2 flex-1 text-sm font-semibold text-fg2">{item.label}</span>
            <span className="text-sm font-semibold text-fg">{formatApproxCost(item.amount, currency)}</span>
          </div>
        ))}
      </div>

      {/* 0505: 두 층(고정 / 일자별). 각 층 = 큰 제목(진한 구분선+14px 굵게) → 날짜 라벨(12px 회색) → 3열 항목.
          한쪽이 비면 그 제목도 생략(목표6). 계층은 색·선이 아니라 위치(날짜 라벨만 왼쪽 머리)로 가른다.
          0507 후속: 접힘(기본) 상태는 두 그룹 모두 제목 줄만 — 기간 라벨도 접힘 대상(접힘 높이 동일).
          제목 아래 6px은 헤더 필의 pb-1.5가 담당 → 펼침 첫 요소는 mt 없이 시작. */}
      {/* 0514: 카테고리 목록→첫 그룹 26px(시안 4a) = mt-4(16) + 헤더 pt-2.5(10) */}
      {fixedItems.length > 0 && (
        <div className="mt-4">
          <GroupHeader
            title="여행 고정 비용"
            open={fixedOpen}
            onToggle={() => setFixedOpen((v) => !v)}
          />
          {fixedOpen && (
            <>
              {periodLabel && <p className="text-xs text-muted">{periodLabel}</p>}
              <div className={periodLabel ? 'mt-1.5' : ''}>
                {fixedItems.map((item, i) => (
                  <ItemRow
                    key={`fixed-${i}`}
                    item={item}
                    currency={currency}
                    last={i === fixedItems.length - 1}
                    barClass={barFor(item.category)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {dayGroups.length > 0 && (
        <div className="mt-1.5">
          <GroupHeader
            title="여행 일자별 비용"
            open={dayOpen}
            onToggle={() => setDayOpen((v) => !v)}
          />
          {/* 0505 후속: 제목→첫 일자 6px은 고정 비용과 동일(헤더 필 pb-1.5 담당). gap-3은 일자 그룹 사이(8.5→8.6)만 담당 */}
          {dayOpen && (
            <div className="flex flex-col gap-3">
              {dayGroups.map((group, gi) => (
                <div key={group.day}>
                  <p className="text-xs text-muted">{dayDateLabel(group.day)}</p>
                  <div className="mt-1">
                    {group.items.map((item, i) => (
                      <ItemRow
                        key={`day-${group.day}-${i}`}
                        item={item}
                        currency={currency}
                        last={gi === dayGroups.length - 1 && i === group.items.length - 1}
                        barClass={barFor(item.category)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
