'use client';
import { useActionState, useMemo, useState, useTransition } from 'react';
import { TiptapEditor } from './TiptapEditor';
import SpotMap from '@/components/SpotMapWrapper';
import { MapPin, Wallet } from 'lucide-react';
import type { Spot } from '@prisma/client';
import type { LocalSpot } from '@/lib/types';

// 편집 로드: story_spots 기준(재사용 스팟 포함). spot=공유 Spot, per-visit(review/photo/rating/order)=story_spot.
type LoadedStorySpot = {
  order: number;
  review: string | null;
  photoUrl: string | null;
  rating: number | null;
  spot: Spot & { spotMovies: { movie: { id: string; title: string } }[] };
};
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
  storySpots?: LoadedStorySpot[];
  storyId?: string;
  availablePlans?: PlanWithCosts[];
  initialPlanId?: string | null;
}

export function StoryWriteForm({ action, initialData, userId, storyId, storySpots = [], availablePlans = [], initialPlanId }: StoryWriteFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const [content, setContent] = useState(initialData?.content ?? '');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlanId ?? null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // 재사용 스팟(sp.storyId !== 이 스토리)은 per-visit을 story_spot에서·공유 정보는 spot에서, reusedSpotId 세팅.
  // owned 스팟은 기존대로(spot 필드). movie는 공유 spot 사실이라 재사용 스팟은 라운드트립 안 함(MVP).
  const initialLocalSpots = useMemo(() => storySpots.map((ss): LocalSpot => {
    const sp = ss.spot;
    const reused = storyId != null && sp.storyId !== storyId;
    // 작품: spot_movies 최신 연결순(0185 대표) → 대표 + extraMovieCount. 재사용 스팟도 그 작품이 뜸.
    // 편집 picker는 단수(대표) — 저장 시 owned는 movieId dual-write, 재사용은 SpotMovie upsert(추가, 공유 미삭제).
    const movies = sp.spotMovies.map((sm) => sm.movie);
    return {
      id: sp.id,
      name: sp.name, lat: sp.lat, lng: sp.lng, order: ss.order,
      review: reused ? ss.review : (sp.review ?? null),
      photoUrl: reused ? ss.photoUrl : (sp.photoUrl ?? null),
      rating: ss.rating ?? null,
      address: sp.address, description: sp.description,
      movieId: movies[0]?.id ?? null,
      movieTitle: movies[0]?.title ?? null,
      extraMovieCount: Math.max(0, movies.length - 1),
      nearestStation: sp.nearestStation ?? null,
      transitMinutes: sp.transitMinutes ?? null,
      transitMode: sp.transitMode ?? null,
      reusedSpotId: reused ? sp.id : null,
    };
  }), []);

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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium text-fg">제목</label>
              <input
                id="title"
                name="title"
                type="text"
                defaultValue={initialData?.title ?? ''}
                className="w-full rounded-[10px] px-[14px] py-3 text-sm text-fg bg-surface2 border-0 dark:border dark:border-border focus:outline-none focus:border-primary hover:border-muted focus:shadow-[0_0_0_3px_rgba(77,158,255,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(77,158,255,0.15)] transition-[box-shadow] duration-200"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-fg">본문</label>
              <TiptapEditor
                content={content}
                onChange={setContent}
                userId={userId}
                placeholder="다녀온 그 장소의 이야기를 남겨주세요..."
              />
              <input type="hidden" name="content" value={content} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-fg">태그 <span className="text-muted font-normal">({tags.length}/5)</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="태그 입력 후 Enter"
                  className="flex-1 rounded-[10px] px-[14px] py-2.5 text-sm text-fg bg-surface2 border-0 dark:border dark:border-border placeholder:text-muted focus:outline-none focus:border-primary hover:border-muted focus:shadow-[0_0_0_3px_rgba(77,158,255,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(77,158,255,0.15)] transition-[box-shadow] duration-200"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2.5 rounded-[10px] text-sm bg-surface2 text-fg2 hover:bg-popover transition-colors"
                >
                  추가
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface2 text-fg2 text-xs">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted hover:text-fg2 transition-colors leading-none"
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
                <label className="text-sm font-medium text-fg">내 플랜 연결</label>
                <select
                  value={selectedPlanId ?? ''}
                  onChange={(e) => setSelectedPlanId(e.target.value || null)}
                  className="w-full rounded-[10px] px-[14px] py-3 text-sm text-fg bg-surface2 border-0 dark:border dark:border-border focus:outline-none focus:border-primary hover:border-muted focus:shadow-[0_0_0_3px_rgba(77,158,255,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(77,158,255,0.15)] transition-[box-shadow] duration-200"
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
                    <div className="rounded-[10px] border border-border bg-card p-4 text-sm text-fg2">
                      <div className="flex items-center gap-1.5 mb-3 text-fg">
                        <Wallet size={15} className="text-primary" />
                        <span className="font-medium">예상 비용</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-fg2">합계</span>
                        <span className="font-mono text-fg">{formatAmount(total, plan.currency)}</span>
                      </div>
                      {allItems.length > 0 && (
                        <p className="mt-1.5 text-xs text-muted">
                          {allItems.map((c) => `${c.label} ${formatAmount(c.sum, plan.currency)}`).join(' · ')}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-muted">연결 시 이 비용 정보가 스토리에 공개됩니다</p>
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
              className="w-full mt-1 bg-primary text-white rounded-full py-[13px] text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {initialData
                ? (isPending ? '수정 중...' : '수정')
                : (isPending ? '등록 중...' : '스토리 등록')}
            </button>
            <input type="hidden" name="spots" value={spotsJson} />
            <input type="hidden" name="plan_id" value={selectedPlanId ?? ''} />
      </form>
      {/* SpotMap: 폼과 같은 정렬선 — 지도 마커 오프셋 방지 */}
      <div className="w-full mt-6">
        <div className="border-t border-border pt-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg mb-4">
            <MapPin size={16} />
            여행동선
          </h2>
          <SpotMap spots={initialLocalSpots} canAddSpot={true} onSpotsChange={handleSpotsChange} onPhotoSelect={handlePhotoSelect} />
        </div>
      </div>
    </>
  );
}
