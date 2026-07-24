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
import { STORY_TEMPLATE_HTML } from '@/lib/story/template';

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
  // 새 글(initialData 없음)만 골격 프리필. 수정은 initialData.content(빈 글이면 '')를
  // 그대로 써 기존 글 위에 템플릿이 덧붙지 않음 — 새 글/수정 분기는 이 한 줄이 유일.
  const [content, setContent] = useState(initialData?.content ?? STORY_TEMPLATE_HTML);
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
      <form id="story-write-form" onSubmit={handleSubmit} className="flex flex-col">
            <div className="flex flex-col">
              <label htmlFor="title" className="text-[12px] font-medium text-muted mb-[9px]">제목</label>
              <input
                id="title"
                name="title"
                type="text"
                defaultValue={initialData?.title ?? ''}
                placeholder="제목을 입력하세요"
                className="w-full px-0 pt-[2px] pb-[10px] text-[21px] sm:text-[23px] font-bold tracking-[-0.02em] text-fg bg-transparent border-0 border-b border-border placeholder:text-muted focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col pt-[46px]">
              <label className="text-[12px] font-medium text-muted mb-[9px]">본문</label>
              <TiptapEditor
                content={content}
                onChange={setContent}
                userId={userId}
                placeholder="그곳에서 어떤 장면을 만났나요?..."
              />
              <input type="hidden" name="content" value={content} />
              <p className="text-xs text-muted mt-1.5">
                회색 안내 문구는 저장되지 않아요. 소제목은 자유롭게 바꾸거나 지워도 돼요.
              </p>
            </div>
            <div className="flex flex-col pt-[46px]">
              <label className="text-[12px] font-medium text-muted mb-[9px]">태그 <span className="font-normal">({tags.length}/5)</span></label>
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="태그 입력 후 Enter"
                  className="flex-1 px-0 min-h-[44px] pb-[8px] text-[16px] sm:text-[14px] text-fg bg-transparent border-0 border-b border-border placeholder:text-muted focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="min-h-[44px] px-2 text-[12.5px] text-muted hover:text-fg2 transition-colors"
                >
                  추가
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
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
              <div className="flex flex-col pt-[26px]">
                <label className="text-[12px] font-medium text-muted mb-[9px]">내 플랜 연결</label>
                <select
                  value={selectedPlanId ?? ''}
                  onChange={(e) => setSelectedPlanId(e.target.value || null)}
                  className="w-full px-0 min-h-[44px] pb-[8px] text-[14px] text-fg bg-transparent border-0 border-b border-border focus:outline-none focus:border-primary"
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
                    <div className="mt-4 text-sm text-fg2">
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
            <input type="hidden" name="spots" value={spotsJson} />
            <input type="hidden" name="plan_id" value={selectedPlanId ?? ''} />
      </form>
      {/* SpotMap: 페이지 컨테이너(860) 폭 상속 — 카드 426 고정은 SpotMap fixedSideWidth가 담당 */}
      <div className="w-full mt-6">
        <div className="border-t border-border pt-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg mb-4">
            <MapPin size={16} />
            여행동선
          </h2>
          <SpotMap spots={initialLocalSpots} canAddSpot={true} onSpotsChange={handleSpotsChange} onPhotoSelect={handlePhotoSelect} fixedSideWidth />
        </div>
      </div>
      {/* 등록 버튼: 시안 순서상 여행동선 아래 마지막. form 밖이라 form="story-write-form"으로 연결 —
          클릭 시 폼 submit 이벤트가 발화해 handleSubmit(사진 append 포함)이 그대로 실행됨(payload 불변). */}
      <div className="pt-[46px]">
      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600 mb-3">{state.error}</p>
      )}
      <button
        type="submit"
        form="story-write-form"
        disabled={isPending}
        className="w-full bg-primary text-white rounded-full py-[13px] text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {initialData
          ? (isPending ? '수정 중...' : '수정')
          : (isPending ? '등록 중...' : '스토리 등록')}
      </button>
      </div>
    </>
  );
}
