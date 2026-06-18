'use client';
import { useActionState, useMemo, useState, useTransition } from 'react';
import { TiptapEditor } from './TiptapEditor';
import SpotMap from '@/components/SpotMapWrapper';
import { MapPin } from 'lucide-react';
import type { Spot } from '@prisma/client';
import type { LocalSpot } from '@/lib/types';

type SpotWithMovie = Spot & { movie: { title: string } | null };
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';

type ActionState = { error: string } | null;

export type PlanWithCosts = {
  id: string;
  title: string;
  currency: 'KRW' | 'USD' | 'JPY';
  costs: { category: string; amount: number }[];
  flight: { totalAmount: number } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: '교통', ACCOMMODATION: '숙박',
  FOOD: '식비', ENTRANCE: '입장료', ETC: '기타',
};

function formatAmount(amount: number, currency: string) {
  const localeMap: Record<string, string> = { KRW: 'ko-KR', USD: 'en-US', JPY: 'ja-JP' };
  return new Intl.NumberFormat(localeMap[currency] ?? 'ko-KR', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount);
}

interface StoryWriteFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  initialData?: { title: string; content: string; tags: string[] };
  userId: string;
  spots?: SpotWithMovie[];
  storyId?: string;
  availablePlans?: PlanWithCosts[];
  initialPlanId?: string | null;
}

export function StoryWriteForm({ action, initialData, userId, spots = [], availablePlans = [], initialPlanId }: StoryWriteFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const [content, setContent] = useState(initialData?.content ?? '');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlanId ?? null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialLocalSpots = useMemo(() => spots.map((s): LocalSpot => ({
    id: s.id, name: s.name, lat: s.lat, lng: s.lng, order: s.order,
    photoUrl: s.photoUrl, review: s.review, address: s.address, description: s.description,
    movieId: s.movieId ?? null,
    movieTitle: s.movie?.title ?? null,
  })), []);

  const [spotsJson, setSpotsJson] = useState(() => JSON.stringify(initialLocalSpots));
  const [pendingPhotos, setPendingPhotos] = useState<Map<string, File>>(new Map());

  function handleSpotsChange(newSpots: LocalSpot[]) {
    setSpotsJson(JSON.stringify(newSpots));
    const currentIds = new Set(newSpots.map(s => s.id));
    setPendingPhotos(prev => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!currentIds.has(key)) next.delete(key);
      }
      return next;
    });
  }

  function handlePhotoSelect(spotId: string, file: File | null) {
    setPendingPhotos(prev => {
      const next = new Map(prev);
      if (file) next.set(spotId, file);
      else next.delete(spotId);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    pendingPhotos.forEach((file, tmpId) => {
      fd.append(`spotPhoto_${tmpId}`, file);
    });
    startTransition(() => formAction(fd));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || tags.length >= 5) return;
    setTags([...tags, t]);
    setTagInput('');
  }

  function removeTag(name: string) {
    setTags(tags.filter((t) => t !== name));
  }

  return (
    <>
      <div className="glass-outer p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium text-[#1A1A1A]">제목</label>
              <input
                id="title"
                name="title"
                type="text"
                defaultValue={initialData?.title ?? ''}
                className="w-full border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1A1A1A]">본문</label>
              <TiptapEditor
                content={content}
                onChange={setContent}
                userId={userId}
                placeholder="다녀온 그 장소의 이야기를 남겨주세요..."
              />
              <input type="hidden" name="content" value={content} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1A1A1A]">태그 <span className="text-slate-400 font-normal">({tags.length}/5)</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="태그 입력 후 Enter"
                  className="flex-1 border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-2.5 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2.5 rounded-[10px] text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  추가
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-slate-400 hover:text-slate-700 transition-colors leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input type="hidden" name="tags" value={JSON.stringify(tags)} />
            </div>
            {availablePlans.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1A1A]">내 플랜 연결</label>
                <select
                  value={selectedPlanId ?? ''}
                  onChange={(e) => setSelectedPlanId(e.target.value || null)}
                  className="w-full border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
                >
                  <option value="">연결 안 함</option>
                  {availablePlans.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                {selectedPlanId && (() => {
                  const plan = availablePlans.find((p) => p.id === selectedPlanId);
                  if (!plan) return null;
                  const flightAmount = plan.flight?.totalAmount ?? 0;
                  const total = calcPlanTotal(plan.costs, plan.flight);
                  const byCat = Object.entries(CATEGORY_LABELS)
                    .map(([key, label]) => {
                      const sum = plan.costs
                        .filter((c) => c.category === key)
                        .reduce((s, c) => s + c.amount, 0);
                      return sum > 0 ? { label, sum } : null;
                    })
                    .filter(Boolean) as { label: string; sum: number }[];
                  const allItems = [
                    ...(flightAmount > 0 ? [{ label: '항공', sum: flightAmount }] : []),
                    ...byCat,
                  ];
                  return (
                    <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <p className="font-medium mb-2">이 플랜을 연결하면 아래 비용 정보가 스토리에 공개됩니다</p>
                      <p className="mb-1">합계: {formatAmount(total, plan.currency)}</p>
                      {allItems.length > 0 && (
                        <p className="text-amber-700">
                          {allItems.map((c) => `${c.label} ${formatAmount(c.sum, plan.currency)}`).join(' · ')}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            {state && 'error' in state && (
              <p role="alert" className="text-sm text-red-600">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-1 bg-[#1A1A1A] text-white rounded-full py-[13px] text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {initialData
                ? (isPending ? '수정 중...' : '수정')
                : (isPending ? '등록 중...' : '스토리 등록')}
            </button>
            <input type="hidden" name="spots" value={spotsJson} />
            <input type="hidden" name="plan_id" value={selectedPlanId ?? ''} />
          </div>
        </form>
      </div>
      {/* SpotMap: glass-outer 밖 — backdrop-filter 조상 없음, Mapbox 마커 오프셋 방지 */}
      <div className="w-full mt-6">
        <div className="border-t border-black/10 pt-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A] mb-4">
            <MapPin size={16} />
            여행동선
          </h2>
          <SpotMap spots={initialLocalSpots} canAddSpot={true} onSpotsChange={handleSpotsChange} onPhotoSelect={handlePhotoSelect} />
        </div>
      </div>
    </>
  );
}
