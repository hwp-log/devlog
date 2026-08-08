'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { formatDayLabel, addDays } from '@/lib/plan/format-day-label';
import { formatAmount } from '@/app/(protected)/my-plan/_lib/cost';

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
      className={`flex items-center py-[11px] text-sm${last ? '' : ' border-b border-hairline'}`}
    >
      <span aria-hidden className={`w-[3px] self-stretch shrink-0 ${barClass}`} />
      {/* 0524: 금액 위계 토큰 — 요약(카테고리)과 같은 등급을 써야 다크에서 상세가 요약보다
          밝아지는 역전이 안 생긴다 */}
      <span className="pl-2 pr-5 flex-1 min-w-0 text-cost-label truncate">{name}</span>
      <span className="shrink-0 font-semibold text-cost-amount">{formatAmount(item.amount, currency)}</span>
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
  summary,
  open,
  onToggle,
}: {
  title: string;
  // 0517: "N건 · N만원" 요약 — 호출부가 실제 데이터에서 계산해 전달. 없으면 생략.
  summary?: string;
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
      {/* 0517: 섹션 제목(22px)과 급이 겹치지 않게 강등 — 15px/600 + 6px 회색 점 + 우측 요약.
          접기 동작·hover 필·터치 타겟 구조(0507)는 유지, 표시만 변경. */}
      <span className="mt-2.5 flex items-center rounded-md px-2 py-1.5 group-hover:bg-surface2">
        <span aria-hidden className="w-1.5 h-1.5 rounded-[3px] bg-[#b3b9bd] shrink-0 mr-[9px]" />
        <span className="text-[15px] font-semibold text-fg2">{title}</span>
        {/* 0522: 공통 척도 보조 등급 14px */}
        {summary && <span className="ml-2 text-sm font-medium text-muted">{summary}</span>}
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
  // 0562: 항공권 그룹 — 구 "왕복 항공편" 섹션(0492)을 비용의 형제 그룹으로 편입.
  //   table을 **슬롯으로 받는** 이유: 이 파일은 story/[id]/, PublicFlightTable은 plan-finder/[id]/에
  //   있어 직접 import하면 역방향 의존이 생긴다. CoverPicker의 header 슬롯(0528 "문안은 호출부가
  //   정한다")과 동형 — 표를 호출부가 렌더해 넘긴다.
  flight?: {
    tripType: 'ONE_WAY' | 'ROUND_TRIP';
    totalAmount: number;
    table: React.ReactNode;
  } | null;
}

// 0517: 카테고리 고정색(시안 4a) — rank(비중 순위) 기반 chart 토큰에서 교체.
//   누적 막대 구간·카테고리 줄·접기 항목 줄이 전부 이 맵 하나를 공유(색 왕복 제거의 정본).
//   소유자 뷰 CATEGORY_COLOR(_lib/cost)와는 별개 팔레트. 완전 리터럴만 JIT 스캔 — 조합 금지.
//   0524: 하드코딩 hex → 토큰(lib/theme.ts) — 라이트 파스텔이 다크 배경에서 묻혀(1.5~1.7:1)
//   다크만 값이 갈린다. 클래스 이름은 한 벌이라 대응 규칙은 그대로.
const CATEGORY_BAR: Record<Item['category'], string> = {
  TRANSPORT: 'bg-cat-transport',
  FLIGHT: 'bg-cat-flight',
  FOOD: 'bg-cat-food',
  ACCOMMODATION: 'bg-cat-accommodation',
  ENTRANCE: 'bg-cat-entrance',
  ETC: 'bg-cat-etc',
};

// 0562: 접기 그룹의 위여백 — 첫 그룹만 카테고리 목록과 26px(mt-4 + 헤더 pt-2.5, 0514),
//   이후는 그룹 사이 간격(mt-1.5). 완전 리터럴만 JIT 스캔되므로 클래스는 조합하지 않고 통째 반환.
const GROUP_MT = (first: boolean) => (first ? 'mt-4' : 'mt-1.5');

/**
 * 0492: 예산 요약 — 금액 공개. 총액 먼저 → 한 줄 누적 막대 → 항목별 금액 라벨.
 * (0343 트리맵·"공개 정책(금액 없음)"은 폐기.)
 * 0558: "약 N만원" 만원 근사도 폐기 — 실값(formatAmount) 통일. 비공개는 0557 접근 제어가
 *   글 자체를 가리므로 금액만 흐리는 가공의 존재 이유가 소멸(현우 재정의).
 * ratios는 summarizePlanCost가 비중 내림차순 정렬 보장 — index가 곧 rank(색 결정).
 * 금액은 계획 총액 기준(1인당 환산 없음 — 항목의 1인당/전체 구분이 없어 나누면 틀린 값, 0492 확정).
 * 소비처: plan-finder/[id]뿐(story/[id]·story/new는 요약 한 줄로 대체).
 */
export function PublicCostSection({ summary, headcount, startDate, endDate, flight }: Props) {
  const { ratios, itemGroups, total, currency } = summary;
  // 0507: 두 층 각각 접기 — 기본 접힘. 카테고리 요약(막대·색 라벨)은 접기 대상 아님.
  // 0562: 항공권 그룹이 형제로 합류해 세 층 — 접힘 상태도 각각.
  const [fixedOpen, setFixedOpen] = useState(false);
  const [flightOpen, setFlightOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  if (ratios.length === 0) return null;

  // 0505: 두 층으로 분리 — 고정 비용(day=null: 항공권 + 무장소) / 일자별 비용(day 있는 그룹).
  // 0562: 세 층으로 — 항공권이 고정 비용 **안의 항목**에서 **형제 그룹**으로 승격(고정 다음, 일자별 앞).
  //   구 "항공권이 고정 맨 위"(0505)는 이 승격으로 무효. 총액이 여기와 구 항공 섹션 제목(0492)
  //   두 곳에 나오던 중복이 해소된다 — 이제 그룹 헤더 summary가 유일한 표기.
  //   FLIGHT 제외는 category 기준 — CostCategory enum(schema)에 FLIGHT가 없어 실 PlanCost는
  //   이 값을 절대 못 갖는다(label 문자열 '항공' 매칭보다 견고). summarize의 '항공' 그룹은
  //   이 화면에서 미소비 — 금액·tripType·표 전부 flight prop 한 소스에서 나온다.
  const fixedItems = itemGroups
    .filter((g) => g.day === null)
    .flatMap((g) => g.items)
    .filter((it) => it.category !== 'FLIGHT');
  const dayGroups = itemGroups.filter((g): g is ItemGroup & { day: number } => g.day !== null);
  // 0517: 접기 그룹 요약 "N건 · N만원" — 실제 데이터 합산. KRW는 0.1만원 단위(시안 37.7만원 검산),
  //   비KRW는 시안에 형식이 없어 formatAmount. 합계 0이면 건수만(지어내지 않음).
  const groupSummary = (items: Item[]): string | undefined => {
    if (items.length === 0) return undefined;
    const sum = items.reduce((acc, it) => acc + it.amount, 0);
    if (sum <= 0) return `${items.length}건`;
    // 0558: 만원 근사 폐기 — 전 화면 실값 통일(비공개는 0557이 글 자체를 가리므로 가공 불필요)
    return `${items.length}건 · ${formatAmount(sum, currency)}`;
  };
  const periodLabel =
    startDate && endDate ? `${formatDayLabel(startDate)} ~ ${formatDayLabel(endDate)}` : null;
  const dayDateLabel = (day: number) =>
    startDate ? formatDayLabel(addDays(startDate, day - 1)) : `DAY ${day}`;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        {/* 0516: 총액 26px(시안 4a 실측) — 20px는 한 단 작게 들어간 오차.
            0524: 금액 위계 3단의 최상단(다크 #f2f4f5) */}
        <span className="text-[26px] tracking-[-0.02em] font-bold text-cost-total">
          총 {formatAmount(total, currency)}
        </span>
        <span className="text-sm text-muted">· {headcount}인</span>
      </div>

      {/* 0517: 12px/r6(시안 4a) + 카테고리 고정색 — 구간 색과 아래 이름 옆 막대가 한자리 대응 */}
      <div className="mt-3 flex h-3 rounded-md overflow-hidden bg-surface2">
        {ratios.map((item) => (
          <div
            key={item.category}
            style={{ flexGrow: item.ratio, flexBasis: 0 }}
            className={CATEGORY_BAR[item.category]}
          />
        ))}
      </div>

      {/* 0514: 카테고리 색 = 이름 왼쪽 3px 막대(닷 제거) — 누적 막대 색과 이름의 한자리 대응.
          0517: 실화면 판정으로 2열 확정(sm:grid-cols-2 재복원, 좁아지면 1열). max-width 미적용. */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        {ratios.map((item) => (
          <div key={item.category} className="flex items-center py-2">
            <span aria-hidden className={`w-[3px] self-stretch shrink-0 ${CATEGORY_BAR[item.category]}`} />
            <span className="pl-2 flex-1 text-sm font-semibold text-cost-label">{item.label}</span>
            <span className="text-sm font-semibold text-cost-amount">{formatAmount(item.amount, currency)}</span>
          </div>
        ))}
      </div>

      {/* 0505: 각 층 = 큰 제목(진한 구분선+14px 굵게) → 날짜 라벨(12px 회색) → 3열 항목.
          한쪽이 비면 그 제목도 생략(목표6). 계층은 색·선이 아니라 위치(날짜 라벨만 왼쪽 머리)로 가른다.
          0507 후속: 접힘(기본) 상태는 전 그룹 제목 줄만 — 기간 라벨도 접힘 대상(접힘 높이 동일).
          제목 아래 6px은 헤더 필의 pb-1.5가 담당 → 펼침 첫 요소는 mt 없이 시작.
          0562: 두 층(고정 / 일자별) → 세 층(고정 / 항공권 / 일자별). 위 규칙은 세 층 공통. */}
      {/* 0514: 카테고리 목록→첫 그룹 26px(시안 4a) = mt-4(16) + 헤더 pt-2.5(10), 그룹 사이는 mt-1.5.
          0562: "첫 그룹"이 고정으로 확정돼 있지 않다 — 항공을 고정에서 뺀 뒤로 무장소 비용이 없으면
          항공권이, 항공도 없으면 일자별이 첫 그룹이 된다. 앞 그룹 존재 여부로 산출(GROUP_MT). */}
      {fixedItems.length > 0 && (
        <div className={GROUP_MT(true)}>
          <GroupHeader
            title="여행 고정 비용"
            summary={groupSummary(fixedItems)}
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
                    barClass={CATEGORY_BAR[item.category]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 0562: 항공권 — 고정 비용과 일자별 비용 사이의 형제 그룹(구 "왕복 항공편" 섹션 폐기).
          summary는 다른 두 그룹의 groupSummary("N건 · 금액")를 쓰지 않는다 — 왕복은 실제로
          2편이라 "1건"이 거짓이 된다. 왕복/편도 어휘는 FlightLeg·FlightSearchSection과 한 벌.
          제목은 tripType 무관 "항공권" — 구 제목("왕복 항공편")이 편도 플랜에서 거짓이던 건
          제목이 사라지며 재발 경로 자체가 없어졌다.
          펼침 첫 줄 "조회 시점 기준"은 고정 비용의 기간 라벨(periodLabel)과 같은 자리·같은
          조판 — 구 섹션 sub의 단서를 잃지 않는다. */}
      {flight && (
        <div className={GROUP_MT(fixedItems.length === 0)}>
          <GroupHeader
            title="항공권"
            summary={`${flight.tripType === 'ROUND_TRIP' ? '왕복' : '편도'} · ${formatAmount(flight.totalAmount, currency)}`}
            open={flightOpen}
            onToggle={() => setFlightOpen((v) => !v)}
          />
          {flightOpen && (
            <>
              <p className="text-xs text-muted">조회 시점 기준</p>
              <div className="mt-1.5">{flight.table}</div>
            </>
          )}
        </div>
      )}

      {dayGroups.length > 0 && (
        <div className={GROUP_MT(fixedItems.length === 0 && !flight)}>
          <GroupHeader
            title="여행 일자별 비용"
            summary={groupSummary(dayGroups.flatMap((g) => g.items))}
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
                        barClass={CATEGORY_BAR[item.category]}
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
