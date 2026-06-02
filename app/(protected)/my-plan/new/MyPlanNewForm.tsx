'use client';
import { useState } from 'react';

type CostCategory = 'TRANSPORT' | 'ACCOMMODATION' | 'FOOD' | 'ENTRANCE' | 'ETC';

type PlanItem = {
  id: string;
  name: string;
  category: CostCategory | '';
  amount: number;
};

type DayPlan = {
  day: number;
  items: PlanItem[];
};

type EditorState = {
  title: string;
  currency: 'KRW' | 'USD' | 'JPY';
  startDate: string;
  endDate: string;
  days: DayPlan[];
};

const CATEGORIES: CostCategory[] = ['TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ENTRANCE', 'ETC'];

const CATEGORY_LABEL: Record<CostCategory, string> = {
  TRANSPORT: '교통',
  ACCOMMODATION: '숙박',
  FOOD: '식비',
  ENTRANCE: '입장료',
  ETC: '기타',
};

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

const INPUT_CLASS =
  'border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all';

export function MyPlanNewForm() {
  const [editor, setEditor] = useState<EditorState>({
    title: '',
    currency: 'KRW',
    startDate: '',
    endDate: '',
    days: [],
  });
  const [selectedDay, setSelectedDay] = useState(1);

  function handleDateChange(field: 'startDate' | 'endDate', value: string) {
    setEditor((prev) => {
      const nextStart = field === 'startDate' ? value : prev.startDate;
      const nextEnd = field === 'endDate' ? value : prev.endDate;
      const newDays = calcDays(nextStart, nextEnd, prev.days);
      return { ...prev, [field]: value, days: newDays };
    });
  }

  const hasDays = editor.days.length > 0;
  const clampedDay = hasDays ? Math.min(selectedDay, editor.days.length) : 1;
  const currentItems = editor.days.find((d) => d.day === clampedDay)?.items ?? [];

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
        <p className="text-sm text-slate-400 mb-4">기간을 설정하면 Day 탭이 생성됩니다.</p>
      )}

      {/* 타임라인 */}
      <div className="glass-outer p-6 mb-4">
        {currentItems.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">항목 없음</p>
        ) : null}
      </div>

      {/* 카테고리 비용 막대 */}
      <div className="glass-outer p-5 mb-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
          카테고리별 비용
        </p>
        <div className="flex flex-col gap-2">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center justify-between text-sm">
              <span className="text-slate-600 w-16">{CATEGORY_LABEL[cat]}</span>
              <div className="flex-1 mx-3 h-1.5 bg-slate-100 rounded-full" />
              <span className="text-slate-400 text-xs w-10 text-right">0</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-sm font-semibold">
          <span className="text-[#1A1A1A]">총 비용</span>
          <span className="text-[#1A1A1A]">0</span>
        </div>
      </div>

      {/* 저장 버튼 (4단계에서 구현) */}
      <button
        type="button"
        disabled
        className="w-full bg-[#1A1A1A] text-white rounded-full py-[13px] text-sm font-semibold opacity-40 cursor-not-allowed"
      >
        저장
      </button>
    </div>
  );
}
