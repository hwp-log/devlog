'use client';
import { useState, useMemo, useTransition } from 'react';
import { createPlanWithItemsAction } from './actions';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';

export type PlanItem = {
  id: string;
  name: string;
  category: CostCategory | '';
  amount: number;
};

export type DayPlan = {
  day: number;
  items: PlanItem[];
};

export type EditorState = {
  title: string;
  currency: 'KRW' | 'USD' | 'JPY';
  startDate: string;
  endDate: string;
  region: string;
  movie: string;
  description: string;
  days: DayPlan[];
};

interface Props {
  initialState?: EditorState;
  mode?: 'create' | 'edit';
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

const DEFAULT_STATE: EditorState = {
  title: '',
  currency: 'KRW',
  startDate: '',
  endDate: '',
  region: '',
  movie: '',
  description: '',
  days: [],
};

export function MyPlanNewForm({ initialState, mode = 'create' }: Props) {
  const [editor, setEditor] = useState<EditorState>(initialState ?? DEFAULT_STATE);
  const [selectedDay, setSelectedDay] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const totalCost = CATEGORIES.reduce((sum, cat) => sum + categoryTotals[cat], 0);
  const maxCategoryAmount = Math.max(0, ...CATEGORIES.map((cat) => categoryTotals[cat]));

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

  function handleSave() {
    setSaveError(null);
    const items = editor.days.flatMap((day) =>
      day.items
        .filter((item) => item.name.trim() !== '')
        .map((item, idx) => ({
          day: day.day,
          order: idx + 1,
          name: item.name.trim(),
          category: item.category,
          amount: item.amount,
        })),
    );
    startTransition(async () => {
      const result = await createPlanWithItemsAction({
        title: editor.title,
        currency: editor.currency,
        startDate: editor.startDate,
        endDate: editor.endDate,
        region: editor.region,
        movie: editor.movie,
        description: editor.description,
        items,
      });
      if (result?.error) setSaveError(result.error);
    });
  }

  function removeItem(id: string) {
    setEditor((prev) =>
      updateDayItems(prev, clampedDay, (items) => items.filter((it) => it.id !== id)),
    );
  }

  return (
    <div>
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

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">통화</label>
            <select
              value={editor.currency}
              onChange={(e) =>
                setEditor((p) => ({ ...p, currency: e.target.value as EditorState['currency'] }))
              }
              className={INPUT_CLASS}
            >
              <option value="KRW">KRW — 한국 원</option>
              <option value="USD">USD — 미국 달러</option>
              <option value="JPY">JPY — 일본 엔</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">시작일</label>
            <input
              type="date"
              value={editor.startDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">종료일</label>
            <input
              type="date"
              value={editor.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className={INPUT_CLASS}
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
              Day {day}
              {editor.startDate && (
                <span className="ml-1 text-xs opacity-60">
                  {new Date(
                    new Date(editor.startDate).getTime() + (day - 1) * 86400000,
                  ).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                </span>
              )}
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
          <div className="flex flex-col gap-3">
            {currentItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                  placeholder="장소 이름"
                  className={ITEM_INPUT_CLASS}
                />
                <select
                  value={item.category}
                  onChange={(e) =>
                    updateItem(item.id, { category: e.target.value as CostCategory | '' })
                  }
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
                    updateItem(item.id, { amount: isNaN(raw) ? 0 : Math.max(0, Math.floor(raw)) });
                  }}
                  placeholder="금액"
                  className={ITEM_INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors text-base"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
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

      {/* 카테고리 비용 막대 */}
      <div className="glass-outer p-5 mb-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
          카테고리별 비용
        </p>
        <div className="flex flex-col gap-2">
          {CATEGORIES.map((cat) => {
            const barPct =
              maxCategoryAmount > 0
                ? (categoryTotals[cat] / maxCategoryAmount) * 100
                : 0;
            return (
              <div key={cat} className="flex items-center text-sm gap-2">
                <span className="text-slate-600 w-16 shrink-0">{CATEGORY_LABEL[cat]}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${barPct}%`, backgroundColor: CATEGORY_COLOR[cat] }}
                  />
                </div>
                <span className="text-slate-500 text-xs w-24 text-right shrink-0">
                  {formatAmount(categoryTotals[cat], editor.currency)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-sm font-semibold">
          <span className="text-[#1A1A1A]">총 비용</span>
          <span className="text-[#1A1A1A]">{formatAmount(totalCost, editor.currency)}</span>
        </div>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 mb-2">{saveError}</p>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={mode === 'edit' || !editor.title.trim() || isPending}
        className={`w-full bg-[#1A1A1A] text-white rounded-full py-[13px] text-sm font-semibold transition-colors ${
          mode === 'edit' || !editor.title.trim() || isPending
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-[#333]'
        }`}
      >
        {isPending ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}
