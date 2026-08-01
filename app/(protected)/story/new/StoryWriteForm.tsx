'use client';
import { useActionState, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { TiptapEditor } from './TiptapEditor';
import SpotMap from '@/components/SpotMapWrapper';
import { ChevronDown } from 'lucide-react';
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
import { STORY_TEMPLATE_HTML } from '@/lib/story/template';

type ActionState = { error: string } | null;

// 요약 한 줄은 서버 page가 buildPlanSummaryLine(server-only)으로 문자열 완성해 내려줌 —
// 원 금액(costs·flight)은 클라로 안 옴. 드롭다운 변경은 이 배열 룩업(서버 왕복 없음).
export type PlanWithSummary = {
  id: string;
  title: string;
  description: string | null; // MyPlan.description — 상한 없는 필드라 표시층 2줄 클램프가 방어선
  coverUrl: string | null; // MyPlan.coverUrl — 저장값 그대로. null 0건(실측)이나 방어로 있을 때만 렌더
  summaryLine: string; // "N일 · 스팟 N곳 · N인 · 총 약 N만원" — 상세 PLAN 카드와 단일 소스(0459)
};

interface StoryWriteFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  initialData?: { title: string; content: string; tags: string[] };
  userId: string;
  storySpots?: LoadedStorySpot[];
  storyId?: string;
  availablePlans?: PlanWithSummary[];
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
                className="w-full px-0 pt-[2px] pb-[10px] text-[21px] sm:text-[23px] font-bold tracking-[-0.02em] text-fg bg-transparent border-0 border-b border-border focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col pt-[46px]">
              <label className="text-[12px] font-medium text-muted mb-[9px]">본문</label>
              <TiptapEditor content={content} onChange={setContent} userId={userId} />
              <input type="hidden" name="content" value={content} />
            </div>
            <div className="flex flex-col pt-[46px]">
              <label className="text-[12px] font-medium text-muted mb-[9px]">태그 <span>({tags.length}/5)</span></label>
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  // isComposing 가드(0366) — 한글 IME 조합 중 Enter는 keydown이 2회 옴(조합 커밋 +
                  // 실제 Enter). 커밋 keydown에서 addTag하면 비워진 input에 IME가 마지막 음절을
                  // 재커밋해 태그가 2개(#수리남·#남) 생김. isComposing은 UI Events 표준 속성이라
                  // 상태 추적(compositionstart/end)·비표준 keyCode 229 없이 한 줄로 판별 가능.
                  // React 합성 이벤트엔 없어 nativeEvent 경유.
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                    e.preventDefault();
                    addTag();
                  }}
                  placeholder="태그 입력 후 Enter"
                  className="flex-1 px-0 min-h-[44px] pb-[8px] text-[16px] sm:text-[14px] text-fg bg-transparent border-0 border-b border-border placeholder:text-muted focus:outline-none focus:border-primary"
                />
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
            <input type="hidden" name="spots" value={spotsJson} />
            <input type="hidden" name="plan_id" value={selectedPlanId ?? ''} />
      </form>
      {/* SpotMap: 페이지 컨테이너(860) 폭 상속 — 카드 426 고정은 SpotMap fixedSideWidth가 담당 */}
      {/* 눈썹 클래스 = WRITE/EDIT 헤더 눈썹과 동일 문자열(0341 규격 복제). 공용 <Eyebrow> 추출은 후속 정리 */}
      <div className="w-full pt-[46px]">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">SPOTMAP</p>
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-fg mt-[6px] mb-[16px] break-keep">방문장소</h2>
        <SpotMap spots={initialLocalSpots} canAddSpot={true} onSpotsChange={handleSpotsChange} onPhotoSelect={handlePhotoSelect} fixedSideWidth />
      </div>
      {/* PLAN 블록(목업 구조) — 눈썹·타이틀·select·트리맵이 한 블록. 미선택 상태에도
          눈썹·타이틀·select는 항상 표시(select가 연결 UI라 블록의 본체), 트리맵만 선택 플랜의
          비중이 있을 때 붙는다. 눈썹·타이틀 어휘는 상세 PLAN 블록과 동일(화면 간 일관, §9).
          pt-[46px]는 위 SPOTMAP 블록과의 간격 — 블록 순서 SPOTMAP→PLAN(0387, 하단 수정 버튼과 거리 벌림).
          form 밖 배치: select는 name 없고 hidden plan_id(폼 내부)가 selectedPlanId로 제출(무접촉). */}
      {availablePlans.length > 0 && (
        <div className="flex flex-col pt-[46px]">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">PLAN</p>
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-fg mt-[6px] mb-[16px] break-keep">여행계획</h2>
          {/* appearance-none + 직접 chevron: 네이티브 select는 CSS에 안 잡히는 내장 좌측
              여백(Chrome 4px·Safari 8px 실측)을 그려 트리맵 좌측선과 어긋남. pt-[8px]는
              텍스트를 밑줄 쪽으로 내려 텍스트↔밑줄(~12px) < 밑줄↔트리맵(16px) —
              밑줄이 select 소속으로 읽히게. pr-[24px]는 긴 제목의 chevron 침범 방지. */}
          <div className="relative">
            <select
              aria-label="내 플랜 연결"
              value={selectedPlanId ?? ''}
              onChange={(e) => setSelectedPlanId(e.target.value || null)}
              className="w-full appearance-none pl-0 pr-[24px] pt-[8px] min-h-[44px] text-[16px] sm:text-[14px] text-fg bg-transparent border-0 border-b border-border focus:outline-none focus:border-primary"
            >
              <option value="">연결 안 함</option>
              {availablePlans.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-0 bottom-[10px] text-muted" />
          </div>
          {/* 미리보기 카드는 플랜 선택 시에만. 미선택 시 h2·select만 남는다(0451).
              카드 구조 = 상세 PLAN 카드와 동일(0459 정합): surface2 면 + 커버 미디어 오브젝트 +
              h3 제목 + 소개 2줄 클램프 + 요약 한 줄. 트리맵은 상세와 함께 폐기(0452 방향).
              상세 카드와 의도적 차이 2가지 — h3에 plan-finder 링크 없음(작성 중 이탈 방지),
              소개에 isPublic 게이트 없음(본인 소유 플랜만 노출되는 화면이라 제3자 독자 전제가 없음). */}
          {selectedPlanId && (() => {
            const plan = availablePlans.find((p) => p.id === selectedPlanId);
            if (!plan) return null;
            return (
              <div className="mt-[16px] rounded-[var(--radius-base)] bg-surface2 p-4">
                <div className="flex flex-col min-[480px]:flex-row min-[480px]:items-start gap-4">
                  {plan.coverUrl && (
                    // radius = --radius-base(tiptap img와 동일 어휘). 상세 PLAN 커버와 같은 마크업.
                    <div className="relative w-full aspect-[4/3] min-[480px]:w-[140px] min-[480px]:h-[105px] min-[480px]:aspect-auto shrink-0 overflow-hidden rounded-[var(--radius-base)]">
                      <Image src={plan.coverUrl} alt="" fill sizes="(min-width: 480px) 140px, 100vw" className="object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-[20px] font-bold tracking-[-0.02em] text-fg ${plan.description ? 'mb-[10px]' : ''} break-keep`}>
                      {plan.title}
                    </h3>
                    {plan.description && (
                      <p className="text-[13px] leading-[1.6] text-fg2 line-clamp-2">{plan.description}</p>
                    )}
                    {plan.summaryLine && (
                      <p className="mt-[8px] text-[13px] text-muted">{plan.summaryLine}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
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
