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

const INPUT_CLASS =
  'border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all';

const ITEM_INPUT_CLASS =
  'border-[0.5px] border-black/15 rounded-[10px] px-[10px] py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 transition-all';

// 0504: 여행 고정 비용 입력 — text-base(16px)로 iOS 자동확대 방지(CLAUDE.md §5). Day 행(14px)은 기존 위반이라 미답습.
const DAYLESS_INPUT_CLASS =
  'border-[0.5px] border-black/15 rounded-[10px] px-[10px] py-2.5 text-base text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 transition-all';

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
        className="text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500 transition-colors"
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
        className="w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors text-base"
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
    <div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={!editor.title.trim() || isPending}
          className="px-4 py-1.5 rounded-full text-sm font-semibold bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? '저장 중...' : '저장'}
        </button>
      </div>
      {saveError && (
        <p role="alert" className="text-sm text-red-600 text-right mb-4">{saveError}</p>
      )}

      {/* 헤더 */}
      <div className="glass-outer p-6 mb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1A1A1A]">제목</label>
          <input
            type="text"
            value={editor.title}
            onChange={(e) => setEditor((p) => ({ ...p, title: e.target.value }))}
            placeholder="계획 제목을 입력하세요"
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">출발일</label>
            <input
              type="date"
              value={editor.startDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              className={`${INPUT_CLASS}${dateMissing.start ? ' !border-red-400 focus:!border-red-400' : ''}`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">도착일</label>
            <input
              type="date"
              value={editor.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className={`${INPUT_CLASS}${dateMissing.end ? ' !border-red-400 focus:!border-red-400' : ''}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">지역</label>
            <input
              type="text"
              value={editor.region}
              onChange={(e) => setEditor((p) => ({ ...p, region: e.target.value }))}
              placeholder="예: 서울 용산구 이태원"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">영화</label>
            <input
              type="text"
              value={editor.movie}
              onChange={(e) => setEditor((p) => ({ ...p, movie: e.target.value }))}
              placeholder="예: 이태원 클라쓰"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1A1A1A]">인원수</label>
          <input
            type="number"
            min={HEADCOUNT_MIN}
            max={HEADCOUNT_MAX}
            value={editor.headcount}
            onChange={(e) => {
              const raw = Number(e.target.value);
              setEditor((p) => ({ ...p, headcount: isNaN(raw) ? HEADCOUNT_MIN : clampHeadcount(raw) }));
            }}
            className={`${INPUT_CLASS} w-28`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1A1A1A]">여행계획 간단소개</label>
          <textarea
            value={editor.description}
            onChange={(e) => setEditor((p) => ({ ...p, description: e.target.value }))}
            placeholder={`조광진 웹툰 원작 「이태원 클라쓰」(2020) — 박서준·김다미 주연, 넷플릭스를 타고 일본까지 한류 열풍을 이끈 JTBC 화제작의 촬영지 4곳을 따라가는 코스.
녹사평 육교 → 단밤 포차 자리(GS25 이태원힐점 옆) → 경리단길 어반클리프(이사한 단밤) → 남산공원 백범광장. 서울 공식 관광 추천 코스 기반 / 드라마 속 동선 그대로.`}
            rows={3}
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* 0497: 대표 이미지 선택 — 담은 촬영지 커버 후보가 2개 이상일 때만 표시(컴포넌트 내부 게이트) */}
        <CoverPicker
          items={editor.days.flatMap((d) =>
            d.items
              .filter((it) => it.place && it.name.trim() !== '')
              .map((it) => ({ name: it.name.trim(), lat: it.place!.lat, lng: it.place!.lng })),
          )}
          value={editor.coverUrl}
          onChange={(url) => setEditor((p) => ({ ...p, coverUrl: url }))}
        />
      </div>

      <FlightSearchSection
        startDate={editor.startDate}
        endDate={editor.endDate}
        flight={editor.flight}
        onChange={(offer) => setEditor((p) => ({ ...p, flight: offer }))}
        onDateMissingChange={setDateMissing}
      />

      {/* 0504 2단계: 여행 고정 비용 — 일정에 안 묶인 비용(렌터카·보험 등). 항공(위)의 형제, Day 앞.
          행은 2줄 스택(이름 / 카테고리·금액·삭제) — 360px 리플로우로 잘림 방지(min-w-0 필수). */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
          여행 고정 비용
        </p>
        <div className="glass-outer p-5 flex flex-col gap-3">
          {editor.daylessCosts.map((cost, index) => (
            <div key={index} className="flex flex-col gap-2">
              <input
                type="text"
                value={cost.label}
                onChange={(e) => updateDaylessCost(index, { label: e.target.value })}
                placeholder="이름 (예: 렌터카)"
                className={DAYLESS_INPUT_CLASS + ' w-full'}
              />
              <div className="flex gap-2">
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
                  className={DAYLESS_INPUT_CLASS + ' flex-1 min-w-0'}
                />
                <button
                  type="button"
                  onClick={() => removeDaylessCost(index)}
                  aria-label="항목 삭제"
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-[10px] border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors text-base"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addDaylessCost}
            className="w-full py-2.5 border border-dashed border-slate-300 rounded-[10px] text-sm text-slate-500 hover:bg-slate-50 transition-colors"
          >
            + 항목 추가
          </button>
        </div>
      </div>

      {/* Day 탭 */}
      {hasDays ? (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {editor.days.map(({ day }) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                clampedDay === day
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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
      ) : (
        <p className="text-sm text-slate-400 mb-4">여행 기간을 설정하면, 날짜별 일정과 비용을 작성할 수 있어요.</p>
      )}

      {/* 타임라인 */}
      <div className="glass-outer p-6 mb-4">
        {currentItems.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">항목 없음</p>
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
            className="mt-4 w-full py-2.5 border border-dashed border-slate-300 rounded-[10px] text-sm text-slate-500 hover:bg-slate-50 transition-colors"
          >
            + Day {clampedDay} 항목 추가
          </button>
        )}
      </div>

      <CostSection
        totals={categoryTotals}
        flightAmount={flightAmount}
        total={total}
        currency="KRW"
      />

      <div className="mt-4">
        <Link href="/my-plan" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
          ← 목록으로
        </Link>
      </div>
    </div>
  );
}
