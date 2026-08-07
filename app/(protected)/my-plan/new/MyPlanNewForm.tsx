'use client';
import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
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
import { createPlanWithItemsAction, updatePlanWithItemsAction } from './actions';
import { FlightSearchSection } from './FlightSearchSection';
import { PlaceSearchInput } from './PlaceSearchInput';
import { CoverPicker } from './CoverPicker';
import type { FlightOffer } from '@/lib/flights';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  type CostCategory,
} from '../_lib/cost';
import { CATEGORY_ICON } from '../_components/CostSection';
import { CostSection } from '../_components/CostSection';
import { SectionHeader } from '@/app/(protected)/_components/SectionHeader';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';
import { formatDayLabel, addDays } from '@/lib/plan/format-day-label';
import { clampHeadcount, HEADCOUNT_MIN, HEADCOUNT_MAX } from '@/lib/plan/validate-input';

export type PlanItem = {
  id: string;
  name: string;
  category: CostCategory | '';
  amount: number;
  // 검색-선택한 장소 메타 — 화면 상태에만 보관(저장 payload 미포함, 다음 단계).
  place?: { id: string; lat: number; lng: number; address: string };
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
  daylessCosts: DaylessCost[]; // 0504: 무장소 비용 — UI 없이 복원값을 보관해 재저장 시 소실 방지
  flight: FlightOffer | null;
  coverUrl: string | null; // 0497: 작성자가 고른 대표 이미지(null=자동)
};

interface Props {
  initialState?: EditorState;
  mode?: 'create' | 'edit';
  planId?: string;
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
  daylessCosts: [], // 0504: 신규 플랜은 무장소 비용 없음(입력 UI 다음 단계)
  flight: null,
  coverUrl: null,
};

function SortablePlanItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: PlanItem;
  onUpdate: (id: string, patch: Partial<PlanItem>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-2 items-center${isDragging ? ' opacity-50' : ''}`}
    >
      <button
        type="button"
        aria-label="순서 변경"
        {...attributes}
        {...listeners}
        className="text-hint cursor-grab active:cursor-grabbing hover:text-fg2 transition-colors"
      >
        <GripVertical size={14} />
      </button>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
        style={item.category
          ? { backgroundColor: CATEGORY_COLOR[item.category as CostCategory] + '20', color: CATEGORY_COLOR[item.category as CostCategory] }
          : { backgroundColor: 'white', border: '1.5px solid #e2e8f0' }
        }
      >
        {item.category ? CATEGORY_ICON[item.category as CostCategory] : null}
      </div>
      <PlaceSearchInput
        value={item.name}
        onType={(name) => onUpdate(item.id, { name, place: undefined })}
        onPick={(p) =>
          onUpdate(item.id, {
            name: p.name,
            place: { id: p.id, lat: p.lat, lng: p.lng, address: p.address },
          })
        }
        className={ITEM_INPUT_CLASS}
      />
      <select
        value={item.category}
        onChange={(e) => onUpdate(item.id, { category: e.target.value as CostCategory | '' })}
        className={ITEM_INPUT_CLASS}
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
        value={item.amount === 0 ? '' : item.amount}
        onChange={(e) => {
          const raw = Number(e.target.value);
          onUpdate(item.id, { amount: isNaN(raw) ? 0 : Math.max(0, Math.floor(raw)) });
        }}
        placeholder="금액"
        className={ITEM_INPUT_CLASS}
      />
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="w-7 h-7 flex items-center justify-center rounded-full border border-field-border text-hint hover:text-danger hover:border-danger-border transition-colors text-base"
      >
        ×
      </button>
    </div>
  );
}

export function MyPlanNewForm({ initialState, mode = 'create', planId }: Props) {
  const [editor, setEditor] = useState<EditorState>(initialState ?? DEFAULT_STATE);
  const [selectedDay, setSelectedDay] = useState(1);
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

  const categoryTotals = useMemo(() => {
    const totals: Record<CostCategory, number> = {
      TRANSPORT: 0,
      ACCOMMODATION: 0,
      FOOD: 0,
      ENTRANCE: 0,
      ETC: 0,
    };
    for (const day of editor.days) {
      for (const item of day.items) {
        const cat: CostCategory = item.category === '' ? 'ETC' : item.category;
        totals[cat] += item.amount;
      }
    }
    return totals;
  }, [editor.days]);

  const flightAmount = editor.flight?.totalAmount ?? 0;
  const total = calcPlanTotal(
    Object.values(categoryTotals).map((amount) => ({ amount })),
    editor.flight,
  );

  // 0527: 저장 게이트는 기존 조건 그대로(제목만) — 조판 작업이라 기능 무변.
  //   시안 안내문은 "제목·출발일·도착일"이지만 실제 게이트와 어긋나면 거짓 안내라 문구를 실제에 맞춘다.
  const saveDisabled = !editor.title.trim() || isPending;
  const hasDays = editor.days.length > 0;
  const clampedDay = hasDays ? Math.min(selectedDay, editor.days.length) : 1;
  const currentItems = editor.days.find((d) => d.day === clampedDay)?.items ?? [];

  function addItem() {
    setEditor((prev) =>
      updateDayItems(prev, clampedDay, (items) => [
        ...items,
        { id: crypto.randomUUID(), name: '', category: '', amount: 0 },
      ]),
    );
  }

  function updateItem(id: string, patch: Partial<PlanItem>) {
    setEditor((prev) =>
      updateDayItems(prev, clampedDay, (items) =>
        items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      ),
    );
  }

  function removeItem(id: string) {
    setEditor((prev) =>
      updateDayItems(prev, clampedDay, (items) => items.filter((it) => it.id !== id)),
    );
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
          .filter((item) => item.name.trim() !== '')
          .map((item, idx) => ({
            day: day.day,
            order: idx + 1,
            name: item.name.trim(),
            category: item.category,
            amount: item.amount,
            // 0493 3단계: 검색-선택한 좌표·주소를 저장 경로로. place 없으면 undefined(→서버에서 좌표·spotId NULL).
            lat: item.place?.lat,
            lng: item.place?.lng,
            address: item.place?.address,
          })),
      ),
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
                {currentItems.map((item) => (
                  <SortablePlanItem
                    key={item.id}
                    item={item}
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

      {/* 0497: 대표 이미지 선택 — 후보 게이트는 컴포넌트 내부(0510: 후보 1개부터 렌더, 0장만 미표시).
          0526: 폼 최상단 헤더 카드에서 장소 지정 뒤로 이동(원인 먼저, 결과 나중).
          0528: 다시 카테고리별 비용 **앞**으로 — 0527 개방 캔버스에서 "총 비용" 바로 밑에 붙어
          비용에 딸린 항목처럼 보였다. 대표 이미지는 장소 파생이라 장소 입력 직후가 맞고,
          카테고리별 비용은 "위 항목에서 자동 합산"이라 입력이 다 끝난 뒤에 와야 한다.
          0561: 섹션 순서 정합(일정이 앞으로) 후에도 "장소 입력 직후" 원칙 그대로 —
          이제 여행 일정 바로 다음, 비용·항공 앞.
          헤더를 prop으로 넘겨 게이트(null 가드) 안쪽에서 렌더 — 후보 0장이면 제목도 함께 사라진다. */}
      <CoverPicker
        header={
          <div className="mt-[26px] sm:mt-11">
            <SectionHeader title="대표 이미지" sub="고르지 않으면 자동으로 정해집니다" />
          </div>
        }
        items={editor.days.flatMap((d) =>
          d.items
            .filter((it) => it.place && it.name.trim() !== '')
            .map((it) => ({ name: it.name.trim(), lat: it.place!.lat, lng: it.place!.lng })),
        )}
        value={editor.coverUrl}
        onChange={(url) => setEditor((p) => ({ ...p, coverUrl: url }))}
      />

      {/* 0504 2단계: 여행 고정 비용 — 일정에 안 묶인 비용(렌터카·보험 등).
          0561: 일정 다음·항공 앞으로 이동 — 읽기의 비용 묶음(예상 비용 안 접기 그룹)과 인접 대응.
          행은 2줄 스택(이름 / 카테고리·금액·삭제) — 360px 리플로우로 잘림 방지(min-w-0 필수). */}
      <div className="mt-[26px] sm:mt-11">
        <SectionHeader title="여행 고정 비용" sub="렌터카·숙소처럼 날짜에 안 묶이는 지출" />
      </div>

      {/* 0527: 카드 제거 — 행은 시안 6a의 4열(이름·카테고리·금액·삭제), 360px에선 2줄 스택 유지 */}
      <div className="mt-[18px] flex flex-col">
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
        <button
          type="button"
          onClick={addDaylessCost}
          className="mt-3 w-full py-[14px] border border-dashed border-field-border rounded-lg text-[15px] font-semibold text-fg2 hover:border-primary hover:text-primary transition-colors"
        >
          + 항목 추가
        </button>
      </div>

      <div className="mt-[26px] sm:mt-11">
        <SectionHeader title="항공편" badge="예상" sub="검색 시점의 최저가가 채워집니다" />
      </div>

      <FlightSearchSection
        startDate={editor.startDate}
        endDate={editor.endDate}
        flight={editor.flight}
        onChange={(offer) => setEditor((p) => ({ ...p, flight: offer }))}
        onDateMissingChange={setDateMissing}
      />

      {/* 0561: 읽기 "예상 비용"과 이름 통일. 순서는 읽기(비용→항공)와 의도적으로 다르다 —
          읽기는 훑는 순서, 폼은 입력 흐름(A안, 사용자 확정): 합산은 입력이 아니라 파생이라
          모든 입력(일정·고정·항공)이 끝난 뒤 "저장 직전 확인" 자리가 맞고, 합산이 항공 위로
          가면 sub "위 항목에서 자동 합산"이 거짓이 된다. B안(완전 정합)은 0537 헤더 폭
          전례처럼 정합을 위해 없던 불편을 만드는 것이라 기각. */}
      <div className="mt-[26px] sm:mt-11">
        <SectionHeader title="예상 비용" sub="위 항목에서 자동 합산" />
      </div>

      <CostSection
        totals={categoryTotals}
        flightAmount={flightAmount}
        total={total}
        currency="KRW"
      />

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
