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

// 0567: 항목 줄 — [이름 + 금액] 둘 다 15px/500. 세 그룹이 이 한 조각을 공유한다.
//   구조: 고정 비용은 지출 항목, 일자별은 장소, 항공권은 "탑승료"가 이 자리에 온다.
//   구 ItemRow(0505~0563: 이름·카테고리·금액 **한 줄**, 아래 hairline)는 폐기 —
//   같은 층의 정보를 세 그룹이 서로 다른 골격으로 그리던 게 이번 통일의 대상이었다.
//   행간 구분선(hairline)도 함께 폐기. 당시 근거는 "카테고리 묶음의 세로 안내선(⑨)이 소속을
//   말하므로 가로선까지 있으면 선이 두 언어로 경쟁한다"였는데, **그 세로선도 0567 후속②에서
//   빠졌다**(CostCategoryList 주석 참조). 근거는 사라졌지만 결론은 유지 — 선 없이 들여쓰기 +
//   크기 3단(15/13/12px)만으로 층위가 읽힌다는 게 후속② 실화면 판정의 결과다.
function CostItemRow({
  name,
  amount,
  currency,
}: {
  name: string;
  amount: number;
  currency: PublicCostSummary['currency'];
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <span className="min-w-0 truncate text-[15px] font-medium text-fg">{name}</span>
      <span className="shrink-0 text-[15px] font-medium text-cost-amount tabular-nums">
        {formatAmount(amount, currency)}
      </span>
    </div>
  );
}

// 0567: 카테고리 묶음 — 들여쓰기 16px이 "이 카테고리들은 위 항목에 속한다"를 말한다.
// 0567 후속②: 왼쪽 1px 세로 안내선(border-divider) 폐기 — 실화면 판정에서 **없어도 층위가
//   읽힌다**로 확정. 들여쓰기 + 크기 차(항목 15px / 카테고리 13px)로 충분하고, 선은 그만큼의
//   시각 비용을 더 받아갈 이유가 없었다. 재제안하지 않는다.
//   구 `ml-1 pl-3`은 그 사이에 선을 두려던 분할이라 선이 사라진 지금은 의미가 없다 —
//   같은 16px을 pl-4 하나로. (0345 divider 토큰은 다른 소비처가 있어 그대로 둔다.)
function CostCategoryList({ children }: { children: React.ReactNode }) {
  return <div className="pl-4">{children}</div>;
}

// 0567: 카테고리 줄 — [7px 점 + 이름 13px muted + 금액 12px muted]. 금액이 항목(15px)보다
//   한 단 작은 게 "합계와 내역"의 위계를 만든다(0563 후속② 판정 계승).
//   onToggle이 있으면 버튼 — 항공권의 "왕복(상세내역)" 줄만 해당(⑪).
function CostCategoryRow({
  category,
  label,
  amount,
  currency,
  onToggle,
  open,
}: {
  category: Item['category'];
  label: string;
  amount: number;
  currency: PublicCostSummary['currency'];
  onToggle?: () => void;
  open?: boolean;
}) {
  const body = (
    <>
      <CategoryDot category={category} />
      <span className="text-muted">{label}</span>
      {/* 0567 후속①: 접기 가능한 줄에만 꺾쇠 — 없으면 누를 수 있는 줄로 안 읽힌다.
          오른쪽 끝은 금액이 차지하므로 텍스트 바로 뒤 인라인. 아이콘·방향 규칙은 그룹
          헤더와 같다(접힘=아래·펼침=위, 표준 아코디언) — 크기만 14px로 한 단 작게. */}
      {onToggle && (
        <ChevronDown
          size={14}
          aria-hidden
          className={`shrink-0 text-muted transition-transform${open ? ' rotate-180' : ''}`}
        />
      )}
      <span className="ml-auto text-xs text-muted tabular-nums">
        {formatAmount(amount, currency)}
      </span>
    </>
  );
  if (!onToggle) {
    return <div className="flex items-center gap-1.5 py-[5px] text-[13px]">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-1.5 py-[5px] text-[13px] text-left"
    >
      {body}
    </button>
  );
}

// 0507: 접기 헤더 — 제목 줄 전체가 토글 버튼. 꺾쇠는 우측 끝, 접힘=아래·펼침=위(표준 아코디언).
// 0507 후속: 발견성 — 제목 줄에 무채 surface2 호버 필(데스크톱, v4 hover:는 hover 지원 기기만).
//   버튼을 좌우 8px 넓혀(-mx-2 + calc) 여백까지 히트. 구분선(mx-2)·제목(필 px-2)의 시각
//   x위치는 그대로 상쇄되고, 꺾쇠도 필 content 우측 끝 = 기존 위치.
// 0567: 세 그룹 골격 통일 — 구분선 위 여백이 10px(pt-2.5+mt-2.5)에서 22px로, 아래는 그룹
//   래퍼가 16px(pb-4). 구분선·여백을 **버튼 안에** 두는 건 0507 그대로다(히트 영역에 포함).
//   터치 타겟 재검산: 선~필 mt-[22px] + 필(py-1.5=12 + 텍스트 21) = 55px(≥44, CLAUDE.md §5).
//   구 "선 위치 = 이전 내용 16px 아래(컨테이너 mt-1.5)"는 GROUP_MT 폐기로 무효 —
//   이제 그룹 간격은 앞 그룹의 pb-4 하나가 정한다(첫 그룹 분기 없음).
// 0567: 요약(금액)은 **접혔을 때만** — 펼치면 같은 금액이 아래에 다 있어 중복이다.
function GroupHeader({
  title,
  summary,
  open,
  onToggle,
}: {
  title: string;
  // 0567: 구 "N건 · 금액"에서 건수 제거 — 건수는 펼치면 세면 되고, 접힘 요약이 답할 건 금액이다.
  summary?: string;
  open: boolean;
  onToggle: () => void;
}) {
  // 0567: 요약(금액)은 접혔을 때만 — 펼치면 같은 금액이 아래에 다 있어 중복이다.
  const showSummary = !open && !!summary;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group -mx-2 block w-[calc(100%+16px)] text-left"
    >
      <span aria-hidden className="mx-2 block border-t border-fg/15" />
      {/* 0517: 섹션 제목(22px)과 급이 겹치지 않게 강등 — 15px/600 + 6px 회색 점 + 우측 요약. */}
      <span className="mt-[22px] flex items-center rounded-md px-2 py-1.5 group-hover:bg-surface2">
        <span aria-hidden className="w-1.5 h-1.5 rounded-[3px] bg-[#b3b9bd] shrink-0 mr-[9px]" />
        <span className="text-[15px] font-semibold text-fg2">{title}</span>
        {/* 0522: 공통 척도 보조 등급 14px */}
        {/* 0567 후속③: 금액을 제목 바로 뒤에서 **오른쪽 끝(꺾쇠 왼쪽)** 으로 — 제목 뒤에 두면
            제목 길이에 따라 금액 x위치가 그룹마다 흔들렸다. 오른쪽 끝으로 보내면 위 카테고리
            요약의 금액 열·펼친 그룹의 항목 금액과 세로로 이어진다. 꺾쇠와 간격 12px.
            여백 클래스는 완전 리터럴로 분기 — Tailwind JIT는 조합된 클래스를 못 본다. */}
        {showSummary && (
          <span className="ml-auto shrink-0 pl-2 text-sm font-medium text-muted tabular-nums">
            {summary}
          </span>
        )}
        <ChevronDown
          size={16}
          aria-hidden
          className={`${showSummary ? 'ml-3' : 'ml-auto'} shrink-0 text-muted transition-transform${open ? ' rotate-180' : ''}`}
        />
      </span>
    </button>
  );
}

// 0567: 그룹 래퍼 — 세 그룹이 같은 골격을 쓰게 하는 자리. 위 구분선·22px은 GroupHeader가
//   (버튼 히트 영역이라) 담당하고 여기는 아래 여백 16px만.
const GROUP_WRAP = 'pb-4';

// 0567: 그룹 내용(날짜 줄·항목·카테고리)의 왼쪽 시작선 14px — 헤더 점(6px)+간격(9px) 뒤
//   제목 x위치와 나란히. 세 그룹이 같은 값을 써야 세로로 훑을 때 열이 성립한다.
const GROUP_BODY = 'pl-[14px]';

// 0567: 그룹 두 번째 줄 = 날짜. 세 그룹 공통 등급(13px, fg2 — muted보다 한 단 위).
//   고정·항공은 여행 기간(periodLabel), 일자별은 날짜 선택 줄이 이 자리를 쓴다.
const GROUP_DATE = 'text-[13px] text-fg2';

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
//   완전 리터럴만 JIT 스캔 — 조합 금지.
//   0524: 하드코딩 hex → 토큰(lib/theme.ts) — 라이트 파스텔이 다크 배경에서 묻혀(1.5~1.7:1)
//   다크만 값이 갈린다. 클래스 이름은 한 벌이라 대응 규칙은 그대로.
//   0564: 구 "소유자 뷰 CATEGORY_COLOR(_lib/cost)와는 별개 팔레트" 문구 삭제 — 그 맵이
//   사장돼 제거됐다. 소유자 뷰(CostSection)도 0527부터 같은 cat-* 토큰 한 벌을 쓴다.
const CATEGORY_BAR: Record<Item['category'], string> = {
  TRANSPORT: 'bg-cat-transport',
  PARKING: 'bg-cat-parking',
  FLIGHT: 'bg-cat-flight',
  FOOD: 'bg-cat-food',
  ACCOMMODATION: 'bg-cat-accommodation',
  ENTRANCE: 'bg-cat-entrance',
  ETC: 'bg-cat-etc',
};

// 0567: GROUP_MT(0562, 첫 그룹만 mt-4 / 이후 mt-1.5) 폐기 — 그룹 여백이 "앞 그룹이 있는가"에
//   의존하던 분기를 없앴다. 이제 모든 그룹이 [구분선 + 위 22px + 아래 16px] 한 규칙이라
//   항공 유무·고정 비용 유무로 첫 그룹이 바뀌어도 형태가 같다.

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
  // 0567 ⑪: 항공권 그룹 안의 티켓 표 접기 — 그룹 접기와 별개 층(편별 노선까지 볼지).
  const [ticketOpen, setTicketOpen] = useState(false);
  // 0565: 선택 날짜. null = "아직 안 고름" → 파생으로 dayGroups[0].day를 쓴다.
  //   초깃값에 실제 날짜를 박지 않는 이유: dayGroups는 props에서 오므로 같은 사실이
  //   상태와 props 두 곳에 생긴다(단일 소스 + 파생). 일정 탭의 useState(1) 고정은
  //   여기선 못 쓴다 — 1일차에 비용이 없으면 첫 화면이 빈다.
  const [pickedDay, setPickedDay] = useState<number | null>(null);
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
  // 0517: 접기 그룹 요약 — 실제 데이터 합산.
  // 0558: 만원 근사 폐기 — 전 화면 실값 통일(비공개는 0557이 글 자체를 가리므로 가공 불필요)
  // 0567: 건수("N건 · ") 제거 — 금액만. 합계가 0이면 표시할 게 없어 생략(구 "N건" 폴백도 폐기).
  const groupSummary = (items: { amount: number }[]): string | undefined => {
    const sum = items.reduce((acc, it) => acc + it.amount, 0);
    return sum > 0 ? formatAmount(sum, currency) : undefined;
  };
  const periodLabel =
    startDate && endDate ? `${formatDayLabel(startDate)} ~ ${formatDayLabel(endDate)}` : null;
  const dayDateLabel = (day: number) =>
    startDate ? formatDayLabel(addDays(startDate, day - 1)) : `DAY ${day}`;

  // 0565: 탭 목록 = 비용이 있는 날만(dayGroups 그대로). 0499 "비용 없는 날은 그룹 자체가
  //   안 생김"을 승계 — 눌러도 빈 화면인 탭은 헛걸음이고, 이 섹션은 "얼마 썼나"를 보는
  //   자리라 지출 없는 날은 정보가 아니다. 일정 탭(전 일수)과 개수가 갈리는 건 정확한 표시.
  // 선택 유효성: pickedDay가 목록에 없으면(있을 수 없지만 방어) 첫 탭으로 되돌린다.
  const costDays = dayGroups.map((g) => g.day);
  const selectedCostDay =
    pickedDay != null && costDays.includes(pickedDay) ? pickedDay : costDays[0];
  const selectedGroup = dayGroups.find((g) => g.day === selectedCostDay);

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

      {/* 0517: 실화면 판정으로 2열 확정(sm:grid-cols-2 재복원, 좁아지면 1열). max-width 미적용.
          0567 ⑭: 구 "이름 왼쪽 3px 세로 막대"(0514) 폐기 → 7px 원형 점(CategoryDot).
          아래 세 그룹이 전부 점으로 카테고리를 말하는데 여기만 막대라 표시 언어가 갈렸다.
          색↔카테고리 대응은 바로 위 누적 막대가 이미 하므로 여기 표식은 "어느 카테고리 줄인가"만
          가리키면 된다 — 0563이 일자별에서 "막대는 색만 말해 무엇인지 알 수 없다"로 점을
          택한 판정을 요약 층에도 적용. */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        {ratios.map((item) => (
          <div key={item.category} className="flex items-center gap-2 py-2">
            <CategoryDot category={item.category} />
            <span className="flex-1 text-sm font-semibold text-cost-label">{item.label}</span>
            <span className="text-sm font-semibold text-cost-amount tabular-nums">{formatAmount(item.amount, currency)}</span>
          </div>
        ))}
      </div>

      {/* 0505: 각 층 = 큰 제목(진한 구분선+14px 굵게) → 날짜 라벨(12px 회색) → 3열 항목.
          한쪽이 비면 그 제목도 생략(목표6). 계층은 색·선이 아니라 위치(날짜 라벨만 왼쪽 머리)로 가른다.
          0507 후속: 접힘(기본) 상태는 전 그룹 제목 줄만 — 기간 라벨도 접힘 대상(접힘 높이 동일).
          제목 아래 6px은 헤더 필의 pb-1.5가 담당 → 펼침 첫 요소는 mt 없이 시작.
          0562: 두 층(고정 / 일자별) → 세 층(고정 / 항공권 / 일자별). 위 규칙은 세 층 공통. */}
      {/* 0567 후속③: 카테고리 요약(위 2열)과 첫 그룹 사이 40px — 구 값은 그룹 사이 간격과
          같아 "요약"과 "상세 내역"이 같은 층으로 읽혔다. 그룹 사이(22px)는 그대로라
          이 40px이 두 층을 가르는 유일한 신호가 된다.
          래퍼로 주는 이유: 첫 그룹이 항공 유무·고정 비용 유무로 바뀌므로(0567에서 GROUP_MT를
          없앤 그 이유) 어느 그룹에 mt를 붙이면 분기가 되살아난다. */}
      <div className="mt-10">
      {/* 0567: 그룹 순서 = 항공권 → 고정 → 일자별. 구 순서(고정 → 항공권 → 일자별, 0562)에서
          바뀐 근거 둘 — ① 시간 순서다(항공이 여행의 시작). ② 금액 열이 비던 항공권이 맨 위로
          가야 아래로 열이 안 끊긴다. ②는 0567 ⑪(항공권도 금액 있는 2줄 조판)로 항공권 자체가
          금액을 갖게 돼 약해졌지만, ①만으로 순서는 유지된다.
          구 "첫 그룹이 고정으로 확정돼 있지 않다"(0562)는 고민은 GROUP_MT 폐기로 소멸 —
          어느 그룹이 첫째든 형태가 같다. */}
      {flight && (
        <div className={GROUP_WRAP}>
          <GroupHeader
            title="항공권"
            summary={formatAmount(flight.totalAmount, currency)}
            open={flightOpen}
            onToggle={() => setFlightOpen((v) => !v)}
          />
          {/* 0562: 항공권은 구 "왕복 항공편" 섹션(0492)을 비용의 형제 그룹으로 편입한 것.
              제목은 tripType 무관 "항공권" — 구 제목이 편도 플랜에서 거짓이던 경로가 사라졌다.
              0567: 요약에서 "왕복 ·" 제거 — 왕복/편도는 아래 카테고리 줄이 말한다(⑪).
              0566: 펼침 첫 줄 "조회 시점 기준" 폐기(설명 문구 일괄 제거). */}
          {/* 0567 ⑪: 항공권도 다른 두 그룹과 같은 [항목 줄 + 카테고리 줄] 두 줄로.
              구 조판은 펼치면 곧장 티켓 표라 금액 열이 이 그룹에서만 비어 세로 정렬이 끊겼다.
              항목 줄 "탑승료" / 카테고리 줄 "왕복(상세내역)" — 왕복·편도 어휘는 FlightLeg·
              FlightSearchSection과 한 벌이고, 구 헤더 요약의 "왕복 ·"이 여기로 내려왔다.
              카테고리 줄이 곧 티켓 표 토글(기본 접힘) — 그룹 접기 안의 두 번째 겹이지만
              성격이 다르다(그룹=이 비용을 볼지 / 여기=편별 노선까지 볼지). */}
          {flightOpen && (
            <div className={GROUP_BODY}>
              {periodLabel && <p className={GROUP_DATE}>{periodLabel}</p>}
              <div className="mt-1.5">
                <CostItemRow name="탑승료" amount={flight.totalAmount} currency={currency} />
                <CostCategoryList>
                  <CostCategoryRow
                    category="FLIGHT"
                    label={`${flight.tripType === 'ROUND_TRIP' ? '왕복' : '편도'}(상세내역)`}
                    amount={flight.totalAmount}
                    currency={currency}
                    open={ticketOpen}
                    onToggle={() => setTicketOpen((v) => !v)}
                  />
                  {ticketOpen && <div className="pt-1.5 pb-1">{flight.table}</div>}
                </CostCategoryList>
              </div>
            </div>
          )}
        </div>
      )}

      {fixedItems.length > 0 && (
        <div className={GROUP_WRAP}>
          <GroupHeader
            title="여행 고정 비용"
            summary={groupSummary(fixedItems)}
            open={fixedOpen}
            onToggle={() => setFixedOpen((v) => !v)}
          />
          {fixedOpen && (
            <div className={GROUP_BODY}>
              {periodLabel && <p className={GROUP_DATE}>{periodLabel}</p>}
              {/* 0567 ⑩: 고정 비용 항목도 일자별과 **같은 두 줄 구조** — 구 한 줄
                  (이름 옆에 카테고리가 붙던 0563 조판)은 세 그룹 중 여기만 달랐다.
                  카테고리가 1개라 금액이 두 번 나오지만, 위계(15px 합계 / 12px 내역)가
                  "합계와 내역"으로 읽히게 한다 — 0563 후속②가 일자별에서 이미 확정한 판정. */}
              {fixedItems.map((item, i) => (
                <div key={`fixed-${i}`} className={i === 0 && periodLabel ? 'mt-1.5' : 'pt-[11px]'}>
                  {/* 항공 합성 항목은 '항공권'으로 표기(0505 목표3). 현 구조상 고정 그룹엔
                      FLIGHT가 안 들어오지만(0562 A에서 제외) 라벨 없는 점만 남지 않게 방어. */}
                  <CostItemRow
                    name={item.category === 'FLIGHT' ? '항공권' : item.label}
                    amount={item.amount}
                    currency={currency}
                  />
                  {item.category !== 'FLIGHT' && (
                    <CostCategoryList>
                      <CostCategoryRow
                        category={item.category}
                        label={CATEGORY_LABEL[item.category]}
                        amount={item.amount}
                        currency={currency}
                      />
                    </CostCategoryList>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dayGroups.length > 0 && (
        <div className={GROUP_WRAP}>
          <GroupHeader
            title="여행 일자별 비용"
            summary={groupSummary(dayGroups.flatMap((g) => g.places.flatMap((p) => p.items)))}
            open={dayOpen}
            onToggle={() => setDayOpen((v) => !v)}
          />
          {/* 0563: 장소 단위 층위 — 날짜 → 장소(+합계) → 카테고리 줄.
              구 평면 나열(PlanCost 행 금액순, 0499 롤업 X)은 같은 장소 지출이 흩어지고
              카테고리가 색 막대뿐이라 "얼마가 어디에"에 답을 못 했다.
              0565: 이 중 **날짜 층**이 칩 세로 반복 → 탭 한 줄로 바뀌었다(아래 주석 정본).
              구 서술 "날짜 칩은 일정 Day 탭과 같은 필 형태 / 크기만 보조 등급(12px/500) /
              날짜 블록 간 26px"은 폐기 — 이제 일정 탭과 **같은 컴포넌트·같은 치수**이고,
              블록이 하나뿐이라 블록 간 여백 자체가 없다. 장소·카테고리 조판은 0563 그대로.
              0563 후속②: 카테고리 1건일 때 한 줄로 접던 분기 폐기(실화면 판정) —
              **장소는 항상 [이름+합계] 한 줄, 그 아래 항상 카테고리 나열**.
              접으면 장소마다 형태가 갈려 훑을 때 리듬·열이 깨진다. 채택 사유였던
              "금액 두 번 표기 중복"은 위계(15px 합계 / 13px muted 내역)가 이미
              "합계와 내역"으로 읽히게 해 문제가 아니었다. 재제안하지 않는다. */}
          {dayOpen && selectedGroup && (
            <div className={`flex flex-col ${GROUP_BODY}`}>
              {/* 0565: 날짜 칩 + 소계가 날짜 수만큼 세로로 반복되던 구조(0563) 폐기 — 날짜가
                  여럿이면 세로로 길게 늘어져 한 프레임에 들어오는 정보량이 날짜 수에 비례했다.
                  탭 한 줄이면 정보량이 하루치로 고정돼 인식 부담이 일정하고, 탭이 보이므로
                  다른 날의 존재도 알 수 있다. 탭이 1개여도 생략하지 않는다(그날이 언제인지가
                  사라지고 플랜마다 형태가 갈린다).
                  0567 ⑫: 필 형태(공용 DayTabs) → **텍스트 탭**. 0565가 "같은 플랜의 같은 날짜니
                  일정 탭과 형태가 같아야 한다"로 DayTabs를 썼던 근거를 뒤집는다 — 두 탭은 층위가
                  다르다. 일정 탭은 콘텐츠 전환(섹션의 본체가 통째로 바뀜)이고, 이건 그룹 안의
                  하위 선택이다. 그래서 이 줄은 다른 두 그룹의 **날짜 줄과 같은 자리·같은 크기**
                  (GROUP_DATE 13px)를 쓰고, 선택만 색+1.5px 밑줄로 든다.
                  DayTabs는 무변경 — 일정 섹션이 계속 쓴다(0567 지시).
                  0568: 작성 폼(MyPlanNewForm)의 일자별 비용 탭도 이 리터럴을 준용한다 —
                  **한쪽만 바꾸면 두 화면 형태가 갈린다**(0556 "폼 정합은 조판·용어만").
                  구 소계(탭 줄 오른쪽)와 밑선은 폐기 — 소계는 목록 아래로 내려갔다(⑬). */}
              <div className="flex flex-wrap gap-x-4">
                {costDays.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPickedDay(d)}
                    className={`py-1 text-[13px] whitespace-nowrap transition-colors ${
                      selectedCostDay === d
                        ? 'font-medium text-fg border-b-[1.5px] border-fg'
                        : 'text-muted hover:text-fg2'
                    }`}
                  >
                    {dayDateLabel(d)}
                  </button>
                ))}
              </div>
              {selectedGroup.places.map((place, pi) => (
                <div key={pi} className="pt-[11px]">
                  <CostItemRow name={place.label} amount={place.total} currency={currency} />
                  <CostCategoryList>
                    {place.items.map((it, i) => (
                      <CostCategoryRow
                        key={i}
                        category={it.category}
                        label={CATEGORY_LABEL[it.category]}
                        amount={it.amount}
                        currency={currency}
                      />
                    ))}
                  </CostCategoryList>
                </div>
              ))}
              {/* 0567 후속③: "합계" 줄(+위 구분선) 폐기. 0567 ⑬이 소계를 탭 줄 오른쪽(0565)에서
                  목록 아래로 내렸던 자리다 — 재무 표기 순서(소계는 항목 다음)는 맞았지만,
                  **그 값은 이미 그룹 헤더에 있고 다른 두 그룹엔 합계 줄이 없다.** 빼면 세 그룹이
                  끝나는 방식까지 같아진다(0567의 골격 통일이 여기까지 미치지 않았던 것).
                  구 판정 "탭 옆에선 탭의 값인지 목록의 합인지 헷갈린다"는 지금도 유효 —
                  탭 옆으로 되돌리지는 않는다. */}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
