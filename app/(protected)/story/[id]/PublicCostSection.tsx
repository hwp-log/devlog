'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PublicCostSummary } from '@/lib/plan/summarize-plan-cost';
import { formatDayLabel, addDays } from '@/lib/plan/format-day-label';
import { formatAmount, CATEGORY_LABEL } from '@/app/(protected)/my-plan/_lib/cost';

type ItemGroup = PublicCostSummary['itemGroups'][number];
type Item = ItemGroup['items'][number];

// 0563: 카테고리 점(7px 원형) — 구 3px 세로 막대 폐기. 막대는 색만으로 카테고리를 말해
//   무엇인지 알 수 없었다. 점은 항상 카테고리명과 병기(고정 행·장소 1건 줄·카테고리 줄 공통) —
//   1건일 때와 여러 건일 때의 표시 언어를 하나로 통일. 색 맵은 CATEGORY_BAR 재사용
//   (누적 막대·카테고리 요약과 같은 한자리 대응 유지).
function CategoryDot({ category }: { category: Item['category'] }) {
  return (
    <span aria-hidden className={`w-[7px] h-[7px] rounded-full shrink-0 ${CATEGORY_BAR[category]}`} />
  );
}

// 0505: 항목 행 — 마지막 행만 아래 선 없음.
// 0506: last는 일자 묶음이 아니라 그룹 전체 기준 / 선 두께 1px(0345 실측).
// 0563: 3px 막대 → 점 + 카테고리명 병기 — 고정 비용 행도 일자별과 같은 표시 언어.
// 0563 후속①: 점 위치를 **카테고리명 옆**으로(구 이름 왼쪽) — 일자별 장소 줄과 같은 배치.
//   이름 왼쪽에 두면 그룹 헤더 점과 x축이 겹쳐 "같은 층"으로 읽혀 위계가 어긋난다.
function ItemRow({
  item,
  currency,
  last,
}: {
  item: Item;
  currency: PublicCostSummary['currency'];
  last: boolean;
}) {
  // 항공 합성 항목은 '항공권'으로 표기(0505 목표3). 현 구조상 고정 그룹엔 FLIGHT가 안 들어오지만
  // (0562 A에서 category !== 'FLIGHT'로 제외) 라벨 없는 점만 남지 않게 방어.
  const name = item.category === 'FLIGHT' ? '항공권' : item.label;
  return (
    <div
      className={`flex items-center gap-2 py-[11px] text-sm${last ? '' : ' border-b border-hairline'}`}
    >
      {/* 0524: 금액 위계 토큰 — 요약(카테고리)과 같은 등급을 써야 다크에서 상세가 요약보다
          밝아지는 역전이 안 생긴다 */}
      <span className="min-w-0 truncate text-cost-label">{name}</span>
      {item.category !== 'FLIGHT' && (
        <span className="flex items-center gap-1.5 shrink-0">
          <CategoryDot category={item.category} />
          <span className="text-xs text-muted">{CATEGORY_LABEL[item.category]}</span>
        </span>
      )}
      <span className="ml-auto shrink-0 font-semibold text-cost-amount tabular-nums">
        {formatAmount(item.amount, currency)}
      </span>
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
        {summary && <span className="ml-2 text-sm font-medium text-muted tabular-nums">{summary}</span>}
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
  // 0562(B): headcount prop 제거 — 유일 소비처였던 총액 옆 "· N인"이 지표 밴드로 이관됐다.
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
export function PublicCostSection({ summary, startDate, endDate, flight }: Props) {
  const { ratios, itemGroups, dayGroups, total, currency } = summary;
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
  // 0563: 일자별은 summary.dayGroups(장소 단위 구조)가 정본 — itemGroups는 day=null 전용이 됐다.
  const fixedItems = itemGroups
    .filter((g) => g.day === null)
    .flatMap((g) => g.items)
    .filter((it) => it.category !== 'FLIGHT');
  // 0517: 접기 그룹 요약 "N건 · N만원" — 실제 데이터 합산. KRW는 0.1만원 단위(시안 37.7만원 검산),
  //   비KRW는 시안에 형식이 없어 formatAmount. 합계 0이면 건수만(지어내지 않음).
  // 0563: 건수·합계만 쓰므로 amount만 요구 — dayGroups(장소 단위, label 없음)도 수용
  const groupSummary = (items: { amount: number }[]): string | undefined => {
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
            0524: 금액 위계 3단의 최상단(다크 #f2f4f5)
            0562(B): 총액 옆 "· N인" 제거 — 인원은 지표 밴드의 한 칸이 됐다.
              같은 값을 밴드와 여기 둘로 두면 어느 쪽이 정본인지 흐려진다. */}
        <span className="text-[26px] tracking-[-0.02em] font-bold text-cost-total tabular-nums">
          총 {formatAmount(total, currency)}
        </span>
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
            <span className="text-sm font-semibold text-cost-amount tabular-nums">{formatAmount(item.amount, currency)}</span>
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
            summary={groupSummary(dayGroups.flatMap((g) => g.places.flatMap((p) => p.items)))}
            open={dayOpen}
            onToggle={() => setDayOpen((v) => !v)}
          />
          {/* 0563: 장소 단위 층위 — 날짜 칩(+그날 소계) → 장소(+합계) → 카테고리 줄.
              구 평면 나열(PlanCost 행 금액순, 0499 롤업 X)은 같은 장소 지출이 흩어지고
              카테고리가 색 막대뿐이라 "얼마가 어디에"에 답을 못 했다.
              날짜 칩은 일정 Day 탭과 같은 필 형태(같은 날짜를 같은 모양으로) — 크기만
              보조 등급(12px/500). 칩 아래 1px 선(fg/15 — 그룹 구분선과 같은 값),
              날짜 블록 간 26px.
              0563 후속②: 카테고리 1건일 때 한 줄로 접던 분기 폐기(실화면 판정) —
              **장소는 항상 [이름+합계] 한 줄, 그 아래 항상 카테고리 나열**.
              접으면 장소마다 형태가 갈려 훑을 때 리듬·열이 깨진다. 채택 사유였던
              "금액 두 번 표기 중복"은 위계(15px 합계 / 13px muted 내역)가 이미
              "합계와 내역"으로 읽히게 해 문제가 아니었다. 재제안하지 않는다. */}
          {dayOpen && (
            <div className="flex flex-col">
              {dayGroups.map((group, gi) => (
                <div key={group.day} className={gi === 0 ? '' : 'mt-[26px]'}>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-fg/15">
                    <span className="px-2.5 py-1 rounded-full bg-surface2 text-xs font-medium text-fg2">
                      {dayDateLabel(group.day)}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-cost-amount tabular-nums">
                      {formatAmount(group.total, currency)}
                    </span>
                  </div>
                  {group.places.map((place, pi) => (
                    <div key={pi} className="pt-[11px]">
                      <div className="flex items-baseline justify-between gap-2 min-w-0">
                        <span className="min-w-0 truncate text-[15px] font-medium text-fg">
                          {place.label}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-cost-amount tabular-nums">
                          {formatAmount(place.total, currency)}
                        </span>
                      </div>
                      <div className="pl-[13px]">
                        {place.items.map((it, i) => (
                          <div key={i} className="flex items-center gap-1.5 py-[5px] text-[13px]">
                            <CategoryDot category={it.category} />
                            <span className="text-muted">{CATEGORY_LABEL[it.category]}</span>
                            {/* 장소 합계(cost-amount)보다 한 단 아래 위계(cost-label) */}
                            <span className="ml-auto text-cost-label tabular-nums">
                              {formatAmount(it.amount, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
