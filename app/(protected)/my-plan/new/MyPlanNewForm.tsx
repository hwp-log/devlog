'use client';
import { useState, useMemo, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createPlanWithItemsAction,
  updatePlanWithItemsAction,
  resolvePlanItems,
  type ResolvedItemMeta,
} from './actions';
import { FlightSearchSection } from './FlightSearchSection';
import { PlaceSearchInput } from './PlaceSearchInput';
import type { FlightOffer } from '@/lib/flights';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';
import { CostSection } from '../_components/CostSection';
import { SectionHeader } from '@/app/(protected)/_components/SectionHeader';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';
import { formatDayLabel, addDays, formatDurationLabel } from '@/lib/plan/format-day-label';
import { clampHeadcount, HEADCOUNT_MIN, HEADCOUNT_MAX } from '@/lib/plan/validate-input';

// 0562 D②: category·amount 제거 — 일정 항목은 장소만 담는다(DB의 PlanSpot과 동형).
//   비용은 dayCosts 별도 컬렉션(아래 DayCost) — DB의 PlanCost와 동형. 폼 상태만 한 몸이던
//   구 구조(장부형 행)를 DB 모양에 맞춰 분리.
export type PlanItem = {
  id: string;
  name: string;
  // 검색-선택한 장소 메타 — 좌표·주소만. id는 두지 않는다(0562 D①):
  //   구 place.id는 생성 경로에선 Kakao POI id, 편집 복원에선 우리 Spot.id로 **같은 필드에
  //   다른 의미**가 들어갔다. payload에 안 실려 무해했지만 키로 쓰는 순간 화면마다 다르게
  //   동작한다. 스팟 해소는 서버(resolveReuse)가 (name, lat, lng)로 하므로 클라 id는
  //   어느 의미로도 쓸 곳이 없다 — 의미가 둘인 필드는 맞추는 게 아니라 없애는 게 통일.
  place?: { lat: number; lng: number; address: string };
};

// 0562 D②: 일자별 비용 — PlanCost(day ≠ null)와 동형. localId = 연결 장소의 item.id
//   (편집 복원 시 = PlanSpot.id — 생성·편집 모두 단일 의미), null = 기타 지출(planSpotId NULL).
//   label은 기타 지출용 입력 — 연결 비용의 라벨은 저장 시 서버가 장소 이름으로 강제(단일 소스).
export type DayCost = {
  localId: string | null;
  day: number;
  category: CostCategory | '';
  amount: number;
  label: string;
};

export type DayPlan = {
  day: number;
  items: PlanItem[];
};

// 0504: 하루에 안 묶이는 비용(렌터카·항공권·보험 등). 편집 중 카테고리는 미선택('') 허용 — 저장 시 ETC로 강제(Day 항목과 동형).
export type DaylessCost = {
  label: string;
  category: CostCategory | '';
  amount: number;
};

export type EditorState = {
  title: string;
  currency: 'KRW' | 'USD' | 'JPY';
  startDate: string;
  endDate: string;
  region: string;
  movie: string;
  description: string;
  headcount: number;
  days: DayPlan[];
  dayCosts: DayCost[]; // 0562 D②: 일자별 비용 — 일정 항목에서 분리(PlanCost 동형)
  daylessCosts: DaylessCost[]; // 0504: 무장소 비용 — UI 없이 복원값을 보관해 재저장 시 소실 방지
  flight: FlightOffer | null;
  coverUrl: string | null; // 0497: 작성자가 고른 대표 이미지(null=자동)
};

interface Props {
  initialState?: EditorState;
  mode?: 'create' | 'edit';
  planId?: string;
}

// 0562(C): 저장 대상 항목 판정 — 이름이 빈 행은 저장되지 않는다.
//   지표 밴드의 "장소 N곳"과 handleSave가 **같은 조건**을 써야 저장 직후 읽기 화면의
//   장소 수(= PlanSpot 행 수)와 어긋나지 않는다. 조건을 두 곳에 적으면 조용히 갈린다.
function isSavableItem(item: PlanItem): boolean {
  return item.name.trim() !== '';
}

// 0562 D②: 저장 대상 일자별 비용 판정 — 합산(categoryTotals)과 handleSave가 **같은 선별**을
//   써야 밴드·요약 총액이 저장 결과와 어긋나지 않는다(isSavableItem과 같은 원칙).
//   - 날짜 축소로 사라진 day의 비용은 제외 (구 구조에서 day 소멸 = 항목·비용 동반 소멸과 동형)
//   - 연결 비용은 그 항목이 저장될 때만 (구 구조에서 이름 빈 항목의 금액이 버려지던 것과 동형)
//   - 기타 지출은 라벨 필수 (daylessCosts 선례)
function savableDayCosts(editor: EditorState): DayCost[] {
  const savableIds = new Set(
    editor.days.flatMap((d) => d.items.filter(isSavableItem).map((i) => i.id)),
  );
  return editor.dayCosts.filter(
    (c) =>
      c.day <= editor.days.length &&
      (c.localId ? savableIds.has(c.localId) : c.label.trim() !== ''),
  );
}

function calcDays(startDate: string, endDate: string, prev: DayPlan[]): DayPlan[] {
  if (!startDate || !endDate) return [];
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  if (diff < 0) return [];
  const dayCount = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  return Array.from({ length: dayCount }, (_, i) => {
    const day = i + 1;
    return prev.find((d) => d.day === day) ?? { day, items: [] };
  });
}

function updateDayItems(
  prev: EditorState,
  day: number,
  updater: (items: PlanItem[]) => PlanItem[],
): EditorState {
  return {
    ...prev,
    days: prev.days.map((d) =>
      d.day === day ? { ...d, items: updater(d.items) } : d,
    ),
  };
}

// 0527: 입력 — 시안 6a 실측(padding 13/14, border 1px, radius 8, 16px). 16px은 iOS 포커스
// 자동확대 하한(CLAUDE.md §5). 면은 배경 그대로 두고 테두리만 경계를 만든다(겹은 한 겹).
const INPUT_CLASS =
  'w-full border border-field-border rounded-lg px-[14px] py-[13px] text-base text-fg bg-transparent placeholder:text-hint focus:outline-none focus:border-fg/40 transition-colors';

// 0527: 필드 라벨 12px/600(시안 6a)
const LABEL_CLASS = 'text-xs font-semibold text-fg2';
const FIELD_CLASS = 'flex flex-col gap-[5px]';

// 0561: 로컬 SectionHeader(0527) 폐기 — 공용(_components/SectionHeader, 0531)으로 교체.
//   조판 동일(모바일 20px·badge 포함)이라 시각 무변. 0531 판정대로 위여백(mt)은 컴포넌트가
//   아니라 호출부 래퍼 담당 — 구 first prop의 mt 분기(첫 섹션 sm:mt-[38px] / 이후 sm:mt-11)를
//   각 호출부 div로 이관.

// 0527: Day 항목 입력 — 구 14px은 iOS 포커스 자동확대를 부르는 §5 위반이었다(0504 주석의
//   "기존 위반이라 미답습"을 여기서 해소). 16px 하한으로 통일.
const ITEM_INPUT_CLASS =
  'border border-field-border rounded-lg px-[10px] py-2 text-base text-fg bg-transparent placeholder:text-hint focus:outline-none focus:border-fg/40 transition-colors';

// 0562 E: 항목 메타 해소 디바운스 — 구 CoverPicker(0497)의 값 이식.
const RESOLVE_DEBOUNCE_MS = 400;

// 0504: 여행 고정 비용 입력 — 16px으로 iOS 자동확대 방지(CLAUDE.md §5).
const DAYLESS_INPUT_CLASS =
  'border border-field-border rounded-lg px-[10px] py-2.5 text-base text-fg bg-transparent placeholder:text-hint focus:outline-none focus:border-fg/40 transition-colors';

const DEFAULT_STATE: EditorState = {
  title: '',
  currency: 'KRW',
  startDate: '',
  endDate: '',
  region: '',
  movie: '',
  description: '',
  headcount: 1,
  days: [],
  dayCosts: [],
  daylessCosts: [], // 0504: 신규 플랜은 무장소 비용 없음(입력 UI 다음 단계)
  flight: null,
  coverUrl: null,
};

// 0562 D②: 비용 그룹 헤더 — 읽기(PublicCostSection GroupHeader)의 점+제목 조판(6px 회색 점 +
//   15px/600 fg2 + 우측 보조) 준용. 접기 없음 — 읽기는 훑는 화면이라 접지만 폼은 입력 영역.
//   컴포넌트 공유는 안 한다(0556: 정합은 조판·용어만). 점 색 #b3b9bd는 읽기와 같은 하드코딩
//   화석(토큰화는 별건 — 값이 갈리면 안 되므로 고칠 때 양쪽 함께).
function CostGroupHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mt-7 pt-2.5 border-t border-fg/15">
      <div className="mt-2.5 flex items-center">
        <span aria-hidden className="w-1.5 h-1.5 rounded-[3px] bg-[#b3b9bd] shrink-0 mr-[9px]" />
        <span className="text-[15px] font-semibold text-fg2">{title}</span>
        {sub && <span className="ml-2 text-sm font-medium text-muted break-keep">{sub}</span>}
      </div>
    </div>
  );
}

function SortablePlanItem({
  item,
  index,
  meta,
  isCover,
  onToggleCover,
  onUpdate,
  onRemove,
}: {
  item: PlanItem;
  index: number; // 그날 순번(0-기반) — 읽기 행과 같은 연속 번호 표기용
  meta: ResolvedItemMeta | null; // 서버 해소 결과(재사용 Spot 한정) — 썸네일·칩·주소의 소스
  isCover: boolean;
  onToggleCover: () => void;
  onUpdate: (id: string, patch: Partial<PlanItem>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // 0562 E: 읽기 행(PlanItemRow)과 같은 골격 — [드래그][번호][72px 썸네일][이름·칩·주소][삭제].
  //   썸네일·칩은 해소된 재사용 Spot(meta)에서만 — 없으면 자리 자체 생략(플레이스홀더 금지,
  //   읽기 `{s.coverUrl && …}`·0517과 동일). 주소는 meta.address ?? place.address —
  //   신규 생성될 Spot도 저장 시 Kakao 주소를 가지므로 저장 후 읽기와 같은 표시 규칙.
  //   72px는 사용자 지정(읽기 60px — 폼 행은 입력 박스가 있어 한 단 크게).
  //   썸네일 클릭 = 대표 이미지 토글(0562 E②) — 배지는 항목 단위(coverItemId), 같은 커버를
  //   쓰는 두 행이 있어도 배지는 누른 행에만. 선택 표시는 구 CoverPicker의 border-primary 어휘.
  const address = meta?.address || item.place?.address || null;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 ${isDragging ? ' opacity-50' : ''}`}
    >
      <button
        type="button"
        aria-label="순서 변경"
        {...attributes}
        {...listeners}
        className="shrink-0 text-hint cursor-grab active:cursor-grabbing hover:text-fg2 transition-colors"
      >
        <GripVertical size={14} />
      </button>
      {/* 번호 — 읽기 행과 동일 등급(굵은 회색, #b3b9bd는 읽기와 같은 하드코딩 화석) */}
      <span className="w-[22px] shrink-0 text-sm font-bold text-[#b3b9bd]">{index + 1}</span>
      {meta?.coverUrl && (
        <button
          type="button"
          onClick={onToggleCover}
          aria-pressed={isCover}
          aria-label={isCover ? '대표 이미지 해제' : '대표 이미지로 지정'}
          className={`relative w-[72px] h-[72px] shrink-0 rounded-[10px] overflow-hidden border-[3px] transition ${
            isCover ? 'border-primary' : 'border-transparent hover:border-fg/20'
          }`}
        >
          <Image src={meta.coverUrl} alt="" fill sizes="72px" className="object-cover" />
          {isCover && (
            <span className="absolute left-1 top-1 rounded px-1.5 py-0.5 bg-primary text-white text-xs font-semibold leading-none pt-1">
              대표
            </span>
          )}
        </button>
      )}
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <PlaceSearchInput
          value={item.name}
          onType={(name) => onUpdate(item.id, { name, place: undefined })}
          onPick={(p) =>
            onUpdate(item.id, {
              name: p.name,
              place: { lat: p.lat, lng: p.lng, address: p.address },
            })
          }
          className={ITEM_INPUT_CLASS}
        />
        {(meta?.movie || address) && (
          <div className="flex items-center gap-[7px] min-w-0">
            {meta?.movie && (
              <span className="shrink-0 px-[7px] py-[2px] rounded-[3px] bg-chip-movie-bg text-chip-movie-fg text-xs font-semibold">
                {meta.movie}
              </span>
            )}
            {address && <span className="text-xs text-muted truncate">{address}</span>}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-field-border text-hint hover:text-danger hover:border-danger-border transition-colors text-base"
      >
        ×
      </button>
    </div>
  );
}

export function MyPlanNewForm({ initialState, mode = 'create', planId }: Props) {
  const [editor, setEditor] = useState<EditorState>(initialState ?? DEFAULT_STATE);
  const [selectedDay, setSelectedDay] = useState(1);
  // 0562 D②: 일자별 비용의 날짜 탭 — 일정 탭과 독립 선택(비용 입력 중 일정 탭이 안 튀게)
  const [selectedCostDay, setSelectedCostDay] = useState(1);
  // 0562 E: 항목 메타 해소 캐시(파생 — payload 미포함, 정본은 저장 시 서버 재해소) +
  //   대표 이미지 항목(coverItemId — 배지는 항목 단위, URL 단위면 같은 커버 두 행에 배지 중복)
  const [resolvedById, setResolvedById] = useState<Record<string, ResolvedItemMeta | null>>({});
  const [coverItemId, setCoverItemId] = useState<string | null>(null);
  const resolveSeqRef = useRef(0);
  const resolveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverInitRef = useRef(false); // 편집 복원 배지 초기화 1회 게이트
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dateMissing, setDateMissing] = useState({ start: false, end: false });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDateChange(field: 'startDate' | 'endDate', value: string) {
    setEditor((prev) => {
      const nextStart = field === 'startDate' ? value : prev.startDate;
      const nextEnd = field === 'endDate' ? value : prev.endDate;
      const newDays = calcDays(nextStart, nextEnd, prev.days);
      return { ...prev, [field]: value, days: newDays };
    });
  }

  // 0562 D②: 합산 소스 = 일자별(dayCosts) + 고정(daylessCosts) — 구 구조는 일정 항목에서
  //   합산하고 daylessCosts를 **빼고** 있었다(기존 미정합: 읽기 summarize는 포함 → 폼 총액 과소).
  //   선별은 저장과 같은 조건(savableDayCosts·라벨 필수) — 저장 안 될 금액을 합산에 넣으면
  //   "저장하면 이 모습"(지표 밴드 총액)이 거짓이 된다.
  const categoryTotals = useMemo(() => {
    const totals: Record<CostCategory, number> = {
      TRANSPORT: 0,
      ACCOMMODATION: 0,
      FOOD: 0,
      ENTRANCE: 0,
      ETC: 0,
    };
    for (const c of savableDayCosts(editor)) {
      totals[c.category === '' ? 'ETC' : c.category] += c.amount;
    }
    for (const c of editor.daylessCosts) {
      if (c.label.trim() === '') continue; // 저장 필터(handleSave)와 동일 조건
      totals[c.category === '' ? 'ETC' : c.category] += c.amount;
    }
    return totals;
  }, [editor]);

  const flightAmount = editor.flight?.totalAmount ?? 0;
  const total = calcPlanTotal(
    Object.values(categoryTotals).map((amount) => ({ amount })),
    editor.flight,
  );

  // 0562(C): 지표 밴드 파생값 — 전부 입력에서 계산되는 읽기 전용 값(입력 필드 아님).
  //   읽기 상세(PlanFinderDetail)의 같은 밴드와 값이 맞아야 "저장하면 이 모습"이 성립한다.
  //   장소: 저장 대상 항목 수(isSavableItem) = 저장 후 PlanSpot 행 수 = 읽기의 spots.length.
  const spotCount = useMemo(
    () => editor.days.reduce((n, d) => n + d.items.filter(isSavableItem).length, 0),
    [editor.days],
  );
  // 기간: 날짜 미설정이면 "—". days는 calcDays 산출이라 역순 날짜(diff<0)면 빈 배열이 되므로
  //   길이도 함께 본다 — 그때 formatDurationLabel(0)은 "당일"이 돼 거짓이 된다.
  const durationLabel =
    editor.startDate && editor.endDate && editor.days.length > 0
      ? formatDurationLabel(editor.days.length)
      : '—';

  // 0562 E: 좌표 있는 저장 대상 항목 — 해소 대상. 키는 (id·이름·좌표)라 제목·금액 타이핑과
  //   무관하게 이 값이 바뀔 때만 재조회(구 CoverPicker의 key 관용구 이식, 디바운스·seq 동일).
  const placedItems = useMemo(
    () => editor.days.flatMap((d) => d.items.filter((it) => it.place && isSavableItem(it))),
    [editor.days],
  );
  const resolveKey = JSON.stringify(
    placedItems.map((it) => [it.id, it.name, it.place!.lat, it.place!.lng]),
  );

  useEffect(() => {
    if (resolveDebounceRef.current) clearTimeout(resolveDebounceRef.current);
    const seq = ++resolveSeqRef.current;
    const snapshot = placedItems;
    if (snapshot.length === 0) {
      // 빈 목록 리셋도 타임아웃 경로로 — 효과 본문 동기 setState 금지(린트) + seq 가드 일관
      resolveDebounceRef.current = setTimeout(() => {
        if (seq === resolveSeqRef.current) setResolvedById({});
      }, 0);
      return () => {
        if (resolveDebounceRef.current) clearTimeout(resolveDebounceRef.current);
      };
    }
    resolveDebounceRef.current = setTimeout(async () => {
      try {
        const metas = await resolvePlanItems(
          snapshot.map((it) => ({ name: it.name.trim(), lat: it.place!.lat, lng: it.place!.lng })),
        );
        if (seq !== resolveSeqRef.current) return; // 스테일 응답 폐기
        const next: Record<string, ResolvedItemMeta | null> = {};
        snapshot.forEach((it, i) => {
          next[it.id] = metas[i] ?? null;
        });
        setResolvedById(next);
        // 0562 E②: 편집 복원 배지 초기화 — 첫 해소 도착 시 1회, 기존 coverUrl과 일치하는
        //   **첫 항목**에만(URL 판정이지만 첫 매치 한정이라 배지는 항상 한 행). 일치 없음 =
        //   자동 커버 상태(배지 없음). 이후 배지는 사용자 클릭만 따라간다.
        if (!coverInitRef.current) {
          coverInitRef.current = true;
          const cover = editor.coverUrl;
          if (cover) {
            const hit = snapshot.find((it) => next[it.id]?.coverUrl === cover);
            if (hit) setCoverItemId(hit.id);
          }
        }
      } catch {
        if (seq === resolveSeqRef.current) setResolvedById({}); // 미인증 등 실패는 빈 매핑으로 흡수
      }
    }, RESOLVE_DEBOUNCE_MS);
    return () => {
      if (resolveDebounceRef.current) clearTimeout(resolveDebounceRef.current);
    };
    // resolveKey로 항목 변경만 추적
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveKey]);

  // 0562 E②: 썸네일 클릭 토글 — 지정 시 그 항목의 커버 URL을 payload 값(coverUrl)으로,
  //   재클릭 시 해제(null = 자동: 생성은 resolveCover, 편집은 기존 유지 — 0497 시맨틱 무변).
  //   클릭 = 사용자 의사 확정이라 복원 초기화 게이트도 닫는다(늦게 온 해소가 배지를 덮지 않게).
  function toggleCover(item: PlanItem) {
    coverInitRef.current = true;
    const url = resolvedById[item.id]?.coverUrl ?? null;
    if (!url) return;
    if (coverItemId === item.id) {
      setCoverItemId(null);
      setEditor((p) => ({ ...p, coverUrl: null }));
    } else {
      setCoverItemId(item.id);
      setEditor((p) => ({ ...p, coverUrl: url }));
    }
  }

  // 0527: 저장 게이트는 기존 조건 그대로(제목만) — 조판 작업이라 기능 무변.
  //   시안 안내문은 "제목·출발일·도착일"이지만 실제 게이트와 어긋나면 거짓 안내라 문구를 실제에 맞춘다.
  const saveDisabled = !editor.title.trim() || isPending;
  const hasDays = editor.days.length > 0;
  const clampedDay = hasDays ? Math.min(selectedDay, editor.days.length) : 1;
  const currentItems = editor.days.find((d) => d.day === clampedDay)?.items ?? [];

  // 0562 D②: 일자별 비용 탭·행 — 일정 탭과 같은 클램프 관용구
  const clampedCostDay = hasDays ? Math.min(selectedCostDay, editor.days.length) : 1;
  const currentDayCostEntries = editor.dayCosts
    .map((cost, index) => ({ cost, index })) // index = 전체 배열 기준(갱신·삭제 키)
    .filter(({ cost }) => cost.day === clampedCostDay);
  // 드롭다운 옵션 = 그날 저장 대상 항목(현재 이름 라이브 — 이름이 정본, 라벨 사본 없음)
  const costDayItems =
    editor.days.find((d) => d.day === clampedCostDay)?.items.filter(isSavableItem) ?? [];

  function addItem() {
    setEditor((prev) =>
      updateDayItems(prev, clampedDay, (items) => [
        ...items,
        { id: crypto.randomUUID(), name: '' },
      ]),
    );
  }

  function updateItem(id: string, patch: Partial<PlanItem>) {
    // 0562 E②: 대표 항목의 장소 연결이 바뀌면(타이핑=place 해제 / 재선택=place 교체) 배지·커버
    //   함께 해제 — 커버 URL은 구 장소의 것이라 스테일. 해소 응답 대기 중 일시 상태로 판정하지
    //   않고 명시적 조작 시점에만 해제(디바운스 중 오해제 방지).
    if (id === coverItemId && 'place' in patch) {
      setCoverItemId(null);
      setEditor((prev) => ({
        ...updateDayItems(prev, clampedDay, (items) =>
          items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        ),
        coverUrl: null,
      }));
      return;
    }
    setEditor((prev) =>
      updateDayItems(prev, clampedDay, (items) =>
        items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      ),
    );
  }

  function removeItem(id: string) {
    // 0562 D②: 연결된 일자별 비용도 함께 삭제 — 구 구조(비용이 항목에 부착)에서
    //   항목 삭제 = 비용 삭제였던 동작을 분리 후에도 보존.
    // 0562 E②: 대표 항목 삭제면 배지·커버도 해제.
    if (id === coverItemId) setCoverItemId(null);
    setEditor((prev) => ({
      ...updateDayItems(prev, clampedDay, (items) => items.filter((it) => it.id !== id)),
      dayCosts: prev.dayCosts.filter((c) => c.localId !== id),
      ...(id === coverItemId ? { coverUrl: null } : {}),
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEditor((prev) =>
      updateDayItems(prev, clampedDay, (items) => {
        const oldIdx = items.findIndex((it) => it.id === active.id);
        const newIdx = items.findIndex((it) => it.id === over.id);
        return arrayMove(items, oldIdx, newIdx);
      })
    );
  }

  // 0504: 여행 고정 비용(무장소) — Day와 별개 컬렉션. 순서 무관이라 index로 갱신·삭제.
  function addDaylessCost() {
    setEditor((prev) => ({
      ...prev,
      daylessCosts: [...prev.daylessCosts, { label: '', category: '', amount: 0 }],
    }));
  }

  function updateDaylessCost(index: number, patch: Partial<DaylessCost>) {
    setEditor((prev) => ({
      ...prev,
      daylessCosts: prev.daylessCosts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function removeDaylessCost(index: number) {
    setEditor((prev) => ({
      ...prev,
      daylessCosts: prev.daylessCosts.filter((_, i) => i !== index),
    }));
  }

  // 0562 D②: 일자별 비용 CRUD — daylessCosts와 같은 index 방식(순서 무관).
  //   기본 연결 = 그날 첫 저장 대상 항목, 없으면 기타 지출(null) — 빈 연결을 암묵 생성하지 않음.
  function addDayCost() {
    const defaultLocalId = costDayItems[0]?.id ?? null;
    setEditor((prev) => ({
      ...prev,
      dayCosts: [
        ...prev.dayCosts,
        { localId: defaultLocalId, day: clampedCostDay, category: '', amount: 0, label: '' },
      ],
    }));
  }

  function updateDayCost(index: number, patch: Partial<DayCost>) {
    setEditor((prev) => ({
      ...prev,
      dayCosts: prev.dayCosts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function removeDayCost(index: number) {
    setEditor((prev) => ({
      ...prev,
      dayCosts: prev.dayCosts.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    setSaveError(null);
    const payload = {
      title: editor.title,
      currency: 'KRW' as const,
      startDate: editor.startDate,
      endDate: editor.endDate,
      region: editor.region,
      movie: editor.movie,
      description: editor.description,
      headcount: editor.headcount,
      items: editor.days.flatMap((day) =>
        day.items
          .filter(isSavableItem) // 0562(C): 지표 밴드 "장소 N곳"과 같은 조건(위 정의 참조)
          .map((item, idx) => ({
            day: day.day,
            order: idx + 1,
            name: item.name.trim(),
            // 0562 D②: localId — 서버 2패스가 dayCosts.localId와 이어 planSpotId를 복원.
            localId: item.id,
            // 0493 3단계: 검색-선택한 좌표·주소를 저장 경로로. place 없으면 undefined(→서버에서 좌표·spotId NULL).
            lat: item.place?.lat,
            lng: item.place?.lng,
            address: item.place?.address,
          })),
      ),
      // 0562 D②: 일자별 비용 — 합산과 같은 선별(savableDayCosts). 카테고리 미선택은 ETC 강제
      //   (dayless와 동형). 연결 비용의 label은 서버가 장소 이름으로 강제하므로 여기 값은
      //   기타 지출에서만 의미가 있다.
      dayCosts: savableDayCosts(editor).map((c) => ({
        localId: c.localId,
        day: c.day,
        category: (c.category === '' ? 'ETC' : c.category) as CostCategory,
        amount: c.amount,
        label: c.label.trim(),
      })),
      // 0504: 무장소 비용 — 이름 빈 항목 제외, 미선택 카테고리는 ETC로 강제(Day 항목과 동형).
      daylessCosts: editor.daylessCosts
        .filter((c) => c.label.trim() !== '')
        .map((c) => ({
          label: c.label.trim(),
          category: (c.category === '' ? 'ETC' : c.category) as CostCategory,
          amount: c.amount,
        })),
      flight: editor.flight,
      coverUrl: editor.coverUrl, // 0497: 고른 대표 이미지(null=자동)
    };
    startTransition(async () => {
      if (mode === 'edit' && planId) {
        const result = await updatePlanWithItemsAction(planId, payload);
        if (result?.error) setSaveError(result.error);
      } else {
        const result = await createPlanWithItemsAction(payload);
        if (result?.error) setSaveError(result.error);
      }
    });
  }

  return (
    // 0527: 모바일 저장 고정 바가 마지막 내용을 가리지 않게 하단 여백(시안 6c pb 88px)
    <div className="max-sm:pb-[88px]">
      {/* 0527: 페이지 제목 — 폼이 새 계획·수정 공용이라 여기서 함께 담당(구 new/page.tsx h1 이관).
          수정 화면엔 제목이 아예 없던 비대칭도 해소. */}
      <h1 className="text-[26px] sm:text-[28px] font-bold tracking-[-0.02em] text-fg break-keep">
        {mode === 'edit' ? '계획 수정' : '새 계획'}
      </h1>
      <p className="mt-1.5 sm:mt-2 text-sm text-muted">저장하면 PlanFinder 목록에 공개됩니다</p>

      {saveError && (
        <p role="alert" className="mt-4 text-sm text-danger">{saveError}</p>
      )}

      {/* 0562(C): 지표 밴드 — 읽기 상세(PlanFinderDetail)의 밴드와 **같은 형태·같은 값**.
          입력이 아니라 파생이라 읽기 전용이고, 아래 입력이 바뀌면 즉시 따라 움직인다
          ("저장하면 이 모습"의 예측을 상단에서 먼저 보여준다).
          조판은 읽기 쪽 리터럴 준용 — 열 분배·gap·py·border·글자 등급 전부 동일.
          **한쪽만 바꾸면 두 화면 형태가 갈린다**(짝: PlanFinderDetail 지표 밴드 주석).
          컴포넌트로 공유하지 않는 건 0556 결정(폼 정합은 조판·용어만) — 값 산출만 lib 공유.
          설명 문구는 두지 않는다(사용자 확정) — 라벨이 이미 뜻을 담는다. */}
      <div className="mt-[14px] sm:mt-[22px] grid grid-cols-[auto_auto_auto_1fr] sm:grid-cols-4 gap-x-2 py-[14px] sm:py-5 border-t border-b border-border">
        <div className="flex flex-col gap-[3px] sm:gap-1">
          <span className="text-[11px] sm:text-xs sm:font-medium text-muted">기간</span>
          <span className="text-base sm:text-xl font-bold text-fg">{durationLabel}</span>
        </div>
        <div className="flex flex-col gap-[3px] sm:gap-1">
          <span className="text-[11px] sm:text-xs sm:font-medium text-muted">장소</span>
          <span className="text-base sm:text-xl font-bold text-fg">{spotCount}곳</span>
        </div>
        <div className="flex flex-col gap-[3px] sm:gap-1">
          <span className="text-[11px] sm:text-xs sm:font-medium text-muted">인원</span>
          <span className="text-base sm:text-xl font-bold text-fg">{editor.headcount}인</span>
        </div>
        {/* 값 없으면 "—" — 칸을 빼지 않는다(읽기와 같은 규칙). 장소 0곳·인원 1인은
            실값이라 "—" 대상이 아니다(없는 게 아니라 0이고 기본값). */}
        <div className="flex flex-col gap-[3px] sm:gap-1">
          <span className="text-[11px] sm:text-xs sm:font-medium text-muted">총 비용</span>
          <span className="text-base sm:text-xl font-bold text-fg tabular-nums">
            {total > 0 ? formatAmount(total, 'KRW') : '—'}
          </span>
        </div>
      </div>

      <div className="mt-[26px] sm:mt-[38px]">
        <SectionHeader title="기본 정보" sub="제목과 날짜는 필수" />
      </div>

      {/* 0527: glass-outer 카드 제거 — 개방 캔버스. 입력 테두리는 터치 경계라 유지 */}
      <div className={`mt-[18px] sm:mt-[22px] ${FIELD_CLASS}`}>
        <label className={LABEL_CLASS}>제목</label>
        <input
          type="text"
          value={editor.title}
          onChange={(e) => setEditor((p) => ({ ...p, title: e.target.value }))}
          placeholder="계획 제목을 입력하세요"
          className={INPUT_CLASS}
        />
      </div>

      {/* 0527: 360px에서는 2·3열 필드 전부 1열로 */}
      <div className="mt-[18px] grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
        <div className={FIELD_CLASS}>
          <label className={LABEL_CLASS}>출발일</label>
          <input
            type="date"
            value={editor.startDate}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
            className={`${INPUT_CLASS}${dateMissing.start ? ' !border-danger focus:!border-danger' : ''}`}
          />
        </div>
        <div className={FIELD_CLASS}>
          <label className={LABEL_CLASS}>도착일</label>
          <input
            type="date"
            value={editor.endDate}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
            className={`${INPUT_CLASS}${dateMissing.end ? ' !border-danger focus:!border-danger' : ''}`}
          />
        </div>
      </div>

      <div className="mt-[18px] grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px] gap-[18px]">
        <div className={FIELD_CLASS}>
          <label className={LABEL_CLASS}>지역</label>
          <input
            type="text"
            value={editor.region}
            onChange={(e) => setEditor((p) => ({ ...p, region: e.target.value }))}
            placeholder="예: 서울 용산구 이태원"
            className={INPUT_CLASS}
          />
        </div>
        <div className={FIELD_CLASS}>
          <label className={LABEL_CLASS}>영화</label>
          <input
            type="text"
            value={editor.movie}
            onChange={(e) => setEditor((p) => ({ ...p, movie: e.target.value }))}
            placeholder="예: 이태원 클라쓰"
            className={INPUT_CLASS}
          />
        </div>

        <div className={FIELD_CLASS}>
          <label className={LABEL_CLASS}>인원수</label>
          <input
            type="number"
            min={HEADCOUNT_MIN}
            max={HEADCOUNT_MAX}
            value={editor.headcount}
            onChange={(e) => {
              const raw = Number(e.target.value);
              setEditor((p) => ({ ...p, headcount: isNaN(raw) ? HEADCOUNT_MIN : clampHeadcount(raw) }));
            }}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className={`mt-[18px] ${FIELD_CLASS}`}>
        <label className={LABEL_CLASS}>여행계획 간단소개</label>
        <textarea
          value={editor.description}
          onChange={(e) => setEditor((p) => ({ ...p, description: e.target.value }))}
          placeholder={`조광진 웹툰 원작 「이태원 클라쓰」(2020) — 박서준·김다미 주연, 넷플릭스를 타고 일본까지 한류 열풍을 이끈 JTBC 화제작의 촬영지 4곳을 따라가는 코스.
녹사평 육교 → 단밤 포차 자리(GS25 이태원힐점 옆) → 경리단길 어반클리프(이사한 단밤) → 남산공원 백범광장. 서울 공식 관광 추천 코스 기반 / 드라마 속 동선 그대로.`}
          rows={3}
          className={`${INPUT_CLASS} resize-none leading-[1.7] min-h-[96px]`}
        />
      </div>

      {/* 0561: 읽기(PlanFinderDetail) "여행 일정"과 같은 이름·같은 자리(기본 정보 다음) —
          섹션 순서·용어 정합. sub는 이 섹션이 지출 입력도 겸함을 유지. */}
      <div className="mt-[26px] sm:mt-11">
        <SectionHeader title="여행 일정" sub="장소와 그날 쓴 지출" />
      </div>

      {/* Day 탭 */}
      {hasDays ? (
        <div className="flex gap-2 mt-[18px] mb-4 overflow-x-auto pb-1">
          {editor.days.map(({ day }) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                clampedDay === day
                  ? 'bg-fg text-bg'
                  : 'border border-field-border text-fg2 hover:bg-surface2'
              }`}
            >
              {/* 0511: Day N 병기 제거 — 날짜만(0505 비용 라벨과 동일 포맷, 세 화면 통일).
                  탭은 hasDays(기간 설정) 조건에서만 렌더라 폴백은 방어용 */}
              {editor.startDate
                ? formatDayLabel(addDays(new Date(editor.startDate), day - 1))
                : `Day ${day}`}
            </button>
          ))}
        </div>
      ) : null}

      {/* 0527: 타임라인 카드 제거 — 개방 캔버스. 빈 상태는 지시(15px/600)와 내용(14px 힌트) 2단 */}
      <div className="mb-4">
        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-[34px] border-b border-hairline text-center">
            <p className="text-[15px] font-semibold text-muted">아직 항목이 없습니다</p>
            <p className="text-sm text-hint">
              {hasDays
                ? `아래 버튼으로 ${clampedDay}일차 항목을 추가할 수 있습니다`
                : '여행 기간을 설정하면 날짜별 항목을 추가할 수 있습니다'}
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={currentItems.map((it) => it.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {currentItems.map((item, i) => (
                  <SortablePlanItem
                    key={item.id}
                    item={item}
                    index={i}
                    meta={resolvedById[item.id] ?? null}
                    isCover={coverItemId === item.id}
                    onToggleCover={() => toggleCover(item)}
                    onUpdate={updateItem}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {hasDays && (
          <button
            type="button"
            onClick={addItem}
            className="mt-3 w-full py-[14px] border border-dashed border-field-border rounded-lg text-[15px] font-semibold text-fg2 hover:border-primary hover:text-primary transition-colors"
          >
            + {clampedDay}일차 항목 추가
          </button>
        )}
      </div>

      {/* 0562 E②: 구 "대표 이미지" 섹션(CoverPicker, 0497~0510·0528) 폐기 — 대표 지정은
          일정 행 썸네일 클릭으로 이동(원인과 결과가 한 자리). 후보 0장이면 지정 UI 자체가
          안 뜨고 서버 자동 폴백(resolveCover: 담은 Spot 커버 → 작품 → 지역)은 무변경으로
          돈다. 구 안내 문구("고르지 않으면 자동으로 정해집니다")는 함께 폐기(사용자 확정) —
          안 뜨는 UI의 설명을 남기면 혼란만 된다. */}

      {/* 0562 D②: 비용 입력 전부를 "예상 비용" 아래로 통합(목표 ③) — 요약(파생)이 위,
          입력 그룹 셋(고정 / 항공권 / 일자별)이 아래. 읽기 비용 섹션(요약 → 회색 점 그룹 셋)과
          같은 구조·같은 그룹 이름.
          0561의 "합산은 모든 입력 뒤"(A안 — 비용↔항공 순서 예외) 대체: 당시 예외의 근거였던
          "합산이 항공 위로 가면 sub '위 항목에서 자동 합산'이 거짓"은 입력이 전부 합산 아래로
          들어오면서 소멸했다 — sub도 "아래 입력에서 자동 합산"으로 갱신. */}
      <div className="mt-[26px] sm:mt-11">
        <SectionHeader title="예상 비용" sub="아래 입력에서 자동 합산" />
      </div>

      <CostSection
        totals={categoryTotals}
        flightAmount={flightAmount}
        total={total}
        currency="KRW"
      />

      {/* 그룹 1 — 여행 고정 비용 (0504 UI 그대로 이동, 헤더만 SectionHeader → 그룹 헤더 강등).
          행은 2줄 스택(이름 / 카테고리·금액·삭제) — 360px 리플로우로 잘림 방지(min-w-0 필수). */}
      <CostGroupHeader title="여행 고정 비용" sub="렌터카·숙소처럼 날짜에 안 묶이는 지출" />
      <div className="mt-1 flex flex-col">
        {editor.daylessCosts.map((cost, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 py-3 border-b border-hairline sm:grid sm:grid-cols-[1fr_150px_120px_32px] sm:items-center sm:gap-3 sm:space-y-0"
          >
            <input
              type="text"
              value={cost.label}
              onChange={(e) => updateDaylessCost(index, { label: e.target.value })}
              placeholder="이름 (예: 렌터카)"
              className={DAYLESS_INPUT_CLASS}
            />
            <div className="flex gap-2 sm:contents">
              <select
                value={cost.category}
                onChange={(e) => updateDaylessCost(index, { category: e.target.value as CostCategory | '' })}
                className={DAYLESS_INPUT_CLASS + ' flex-1 min-w-0'}
              >
                <option value="">카테고리</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABEL[cat]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={cost.amount === 0 ? '' : cost.amount}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  updateDaylessCost(index, { amount: isNaN(raw) ? 0 : Math.max(0, Math.floor(raw)) });
                }}
                placeholder="금액"
                className={DAYLESS_INPUT_CLASS + ' flex-1 min-w-0 sm:text-right'}
              />
              <button
                type="button"
                onClick={() => removeDaylessCost(index)}
                aria-label="항목 삭제"
                className="w-11 h-11 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center rounded-md text-hint hover:bg-surface2 hover:text-fg2 transition-colors text-base"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {/* 0562 D②: 구 "+ 항목 추가" — 그룹이 셋이 되며 무엇의 항목인지 모호해져 명시 */}
        <button
          type="button"
          onClick={addDaylessCost}
          className="mt-3 w-full py-[14px] border border-dashed border-field-border rounded-lg text-[15px] font-semibold text-fg2 hover:border-primary hover:text-primary transition-colors"
        >
          + 고정 비용 추가
        </button>
      </div>

      {/* 그룹 2 — 항공권 (구 "항공편" 독립 섹션 이동). 구 badge "예상"은 상위 섹션 이름
          "예상 비용"이 대체. 그룹 이름은 읽기의 항공권 그룹(0562 A)과 통일. */}
      <CostGroupHeader title="항공권" sub="검색 시점의 최저가가 채워집니다" />
      <FlightSearchSection
        startDate={editor.startDate}
        endDate={editor.endDate}
        flight={editor.flight}
        onChange={(offer) => setEditor((p) => ({ ...p, flight: offer }))}
        onDateMissingChange={setDateMissing}
      />

      {/* 그룹 3 — 여행 일자별 비용 (0562 D② 신설): 날짜 탭(일정 탭과 같은 포맷·독립 선택)
          + 행 = [장소 드롭다운(그날 일정 한정 + 기타 지출) / 카테고리·금액·삭제].
          행 조판은 고정 비용 행의 2줄 스택 준용 — 360px 리플로우 동일. */}
      <CostGroupHeader title="여행 일자별 비용" sub="그날 일정의 장소별 지출" />
      {hasDays ? (
        <>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {editor.days.map(({ day }) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedCostDay(day)}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  clampedCostDay === day
                    ? 'bg-fg text-bg'
                    : 'border border-field-border text-fg2 hover:bg-surface2'
                }`}
              >
                {editor.startDate
                  ? formatDayLabel(addDays(new Date(editor.startDate), day - 1))
                  : `Day ${day}`}
              </button>
            ))}
          </div>
          <div className="flex flex-col">
            {currentDayCostEntries.map(({ cost, index }) => (
              <div key={index} className="flex flex-col gap-2 py-3 border-b border-hairline">
                {/* 0562 D fix③: 기타 지출의 라벨은 **행 위 전폭 한 줄** — 구 조판(드롭다운 아래
                    같은 열에 스택)은 왼쪽 열만 2줄로 커져 카테고리·금액이 중간 높이에 떠 보였다
                    (실검수 발견). 고정 비용 행의 모바일 문법(이름 한 줄 / 나머지 아래 줄) 준용. */}
                {cost.localId === null && (
                  <input
                    type="text"
                    value={cost.label}
                    onChange={(e) => updateDayCost(index, { label: e.target.value })}
                    placeholder="지출 이름 (예: 주차비)"
                    className={DAYLESS_INPUT_CLASS + ' w-full'}
                  />
                )}
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_150px_120px_32px] sm:items-center sm:gap-3">
                  {/* 장소 연결 — 값 '' = 기타 지출(localId null → planSpotId NULL 저장).
                      옵션은 그날 저장 대상 항목의 **현재 이름**을 라이브 렌더 — 이름이 정본이라
                      라벨 사본을 만들지 않는다(저장 시 서버가 장소 이름으로 라벨 강제). */}
                  <select
                    value={cost.localId ?? ''}
                    onChange={(e) =>
                      updateDayCost(index, { localId: e.target.value === '' ? null : e.target.value })
                    }
                    className={DAYLESS_INPUT_CLASS + ' w-full min-w-0'}
                  >
                    {costDayItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                    <option value="">기타 지출</option>
                  </select>
                  <div className="flex gap-2 sm:contents">
                  <select
                    value={cost.category}
                    onChange={(e) =>
                      updateDayCost(index, { category: e.target.value as CostCategory | '' })
                    }
                    className={DAYLESS_INPUT_CLASS + ' flex-1 min-w-0'}
                  >
                    <option value="">카테고리</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABEL[cat]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={cost.amount === 0 ? '' : cost.amount}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      updateDayCost(index, { amount: isNaN(raw) ? 0 : Math.max(0, Math.floor(raw)) });
                    }}
                    placeholder="금액"
                    className={DAYLESS_INPUT_CLASS + ' flex-1 min-w-0 sm:text-right'}
                  />
                  <button
                    type="button"
                    onClick={() => removeDayCost(index)}
                    aria-label="항목 삭제"
                    className="w-11 h-11 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center rounded-md text-hint hover:bg-surface2 hover:text-fg2 transition-colors text-base"
                  >
                    ✕
                  </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addDayCost}
              className="mt-3 w-full py-[14px] border border-dashed border-field-border rounded-lg text-[15px] font-semibold text-fg2 hover:border-primary hover:text-primary transition-colors"
            >
              + {clampedCostDay}일차 비용 추가
            </button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-hint">
          여행 기간을 설정하면 날짜별 비용을 추가할 수 있습니다
        </p>
      )}

      {/* 0527 ⑤: 저장은 최종 행동이라 하단 전폭 파랑. 비활성도 회색이 아니라 파랑 40% —
          0530: 글자는 흰색(primary 면 위 주요 버튼 공통, 사용자 확정 — 아래 CopyPlanFinderButton 주석 참조).
          "못 누른다"만 알리고 최종 행동이라는 인상은 유지. 데스크톱은 흐름 끝, 모바일은 고정 바. */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saveDisabled}
        className="max-sm:hidden mt-9 w-full py-4 rounded-lg bg-primary text-white text-base font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? '저장 중...' : '저장'}
      </button>
      {saveDisabled && !isPending && (
        <p className="max-sm:hidden mt-2.5 text-sm text-muted text-center">
          제목을 입력하면 저장할 수 있습니다
        </p>
      )}

      <div className="mt-7">
        <Link href="/my-plan" className="text-sm font-semibold text-fg2 hover:text-fg transition-colors">
          ← 목록으로
        </Link>
      </div>

      {/* 0527: 모바일 저장 고정 바(시안 6c) — iOS 홈바 대응 safe-area 합산(CLAUDE.md §5) */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/[.94] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className="w-full py-[15px] rounded-lg bg-primary text-white text-base font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
