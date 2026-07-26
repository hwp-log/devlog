'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Star, Trash2, X } from 'lucide-react';
import type { LocalSpot } from '@/lib/types';
import { searchMoviesAction, submitMovie } from '@/app/movies/actions';
import type { MovieSuggestion } from '@/lib/movie/queries';
import { formatTransit } from '@/lib/spot/transit';

function normalizeTitle(s: string) {
  return s.toLowerCase().replace(/\s+/g, '');
}

type SpotPopupProps = {
  spot: LocalSpot;
  onDelete?: () => void;
  onClose?: () => void;
  readOnly?: boolean;
  onUpdate?: (fields: { name?: string; review?: string; photoUrl?: string | null; movieId?: string | null; movieTitle?: string | null; rating?: number | null }) => void;
  onFileSelect?: (file: File | null) => void;
  initialEditing?: boolean;
  initialNameInput?: string;
  // 0378: 닫기 핸들 노출 — 모바일 전체화면 모달의 뒤로가기(popstate)가 handleClose를 경유해야
  // 생성 세션 스팟 제거(0365)가 실행됨. 판정(isCreationSession)의 단일 소스는 이 컴포넌트 유지.
  closeHandleRef?: { current: (() => void) | null };
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

// 검증의 단일 소스 — 파일 검증(크기·타입)과 이름 필수 가드를 전부 스키마로 흡수
const spotFormSchema = z.object({
  name: z.string().trim().min(1),
  review: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
  movieQuery: z.string(),
  movieId: z.string().nullable(),
  movieTitle: z.string(),
  photoFile: z
    .instanceof(File)
    .nullable()
    .refine((f) => !f || f.size <= MAX_SIZE, '5MB 이하만 가능합니다')
    .refine((f) => !f || ALLOWED_TYPES.includes(f.type), 'jpeg, png, webp만 허용됩니다'),
  photoCleared: z.boolean(),
});
type SpotFormValues = z.infer<typeof spotFormSchema>;

export function SpotPopup({ spot, onDelete, onClose, readOnly = false, onUpdate, onFileSelect, initialEditing = false, initialNameInput, closeHandleRef }: SpotPopupProps) {
  // UI 상태만 useState 잔류 (movieSuggestions는 서버 검색 캐시 — Query 프로바이더 부재로 잔류)
  const [isEditing, setIsEditing] = useState(initialEditing);
  // 생성 직후 최초 편집 세션인가(0365) — 스팟은 addSpot 시점에 이미 localSpots·payload에 들어가
  // 있으므로, 저장 전 이탈(취소·닫기)은 스팟 제거가 정합. 판정을 "이름 비었나"로 하면 검색·재사용
  // 경로(이름 채워짐)가 새는 것이 원래 버그 — initialEditing 시작 + 미저장으로 판정한다.
  // key={spot.id} 재마운트라 스팟 간 세션이 섞이지 않음. 저장(onValid)하면 확정 → false.
  const [isCreationSession, setIsCreationSession] = useState(initialEditing);
  const [movieSuggestions, setMovieSuggestions] = useState<MovieSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 저장 시 부모(onUpdate)로 넘긴 blob URL — cleanup revoke 대상에서 제외 (소유권 이전)
  const handedOffUrlRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<SpotFormValues>({
    resolver: zodResolver(spotFormSchema),
    defaultValues: {
      name: initialNameInput ?? spot.name,
      review: spot.review ?? '',
      rating: spot.rating ?? null,
      movieQuery: '',
      movieId: spot.movieId ?? null,
      movieTitle: spot.movieTitle ?? '',
      photoFile: null,
      photoCleared: false,
    },
  });

  const nameValue = watch('name');
  const rating = watch('rating');
  const photoFile = watch('photoFile');
  const photoCleared = watch('photoCleared');
  const movieQuery = watch('movieQuery');
  const movieId = watch('movieId');
  const movieTitle = watch('movieTitle');

  // preview는 상태가 아니라 photoFile의 파생값
  const previewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== handedOffUrlRef.current) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 편집 세션의 시작/취소 = 서버 데이터(spot props) 기준 폼 리셋
  function resetToSpot() {
    reset({
      name: spot.name,
      review: spot.review ?? '',
      rating: spot.rating ?? null,
      movieQuery: '',
      movieId: spot.movieId ?? null,
      movieTitle: spot.movieTitle ?? '',
      photoFile: null,
      photoCleared: false,
    });
  }

  function enterEdit() {
    resetToSpot();
    setMovieSuggestions([]);
    setShowDropdown(false);
    setIsEditing(true);
  }

  function handleMovieInput(value: string) {
    setValue('movieQuery', value);
    setValue('movieId', null);
    setValue('movieTitle', '');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setMovieSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await searchMoviesAction(value);
      setMovieSuggestions(results);
      setShowDropdown(true);
    }, 300);
  }

  async function handleSubmitNew() {
    const result = await submitMovie(movieQuery);
    if ('error' in result) { setError('root.server', { message: result.error }); return; }
    selectMovie({ id: result.movie.id, title: result.movie.title, spotCount: 0 });
  }

  function selectMovie(m: MovieSuggestion) {
    setValue('movieId', m.id);
    setValue('movieTitle', m.title);
    setValue('movieQuery', '');
    setMovieSuggestions([]);
    setShowDropdown(false);
  }

  function clearMovie() {
    setValue('movieId', null);
    setValue('movieTitle', '');
    setValue('movieQuery', '');
    setMovieSuggestions([]);
    setShowDropdown(false);
  }

  // 닫기 공용(0365) — 생성 세션(저장 전)에 닫으면 취소와 동일하게 스팟 제거 후 메뉴 복귀.
  // 같은 화면에서 취소=제거 / 닫기=잔존이면 비대칭이고, 이름 빈 스팟이 payload에 남는 문제도 차단.
  function handleClose() {
    if (isCreationSession) onDelete?.();
    onClose?.();
  }

  // 0378: 핸들 대입은 effect에서 — 렌더 중 ref 쓰기 금지(기존 eslint refs-during-render 3건에
  // 신규 불추가). 의존성 없는 매 커밋 재대입 = 최신 클로저(isCreationSession) 유지. 대입이 첫
  // 페인트보다 늦어도 닫기는 사용자 조작 이후라 무해. 언마운트 시 해제(스테일 핸들 차단).
  useEffect(() => {
    if (!closeHandleRef) return;
    closeHandleRef.current = handleClose;
    return () => {
      closeHandleRef.current = null;
    };
  });

  // 취소 = 온 곳으로(0365) — 생성 세션이면 스팟 제거 + 메뉴, 기존 스팟 수정이면 보기 팝업 복귀.
  function cancelEdit() {
    if (isCreationSession) {
      handleClose();
      return;
    }
    resetToSpot();
    setIsEditing(false);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 선택 즉시 검증 — 스키마 필드를 그대로 재사용 (검증 로직 중복 없음)
    const parsed = spotFormSchema.shape.photoFile.safeParse(file);
    if (!parsed.success) {
      setError('photoFile', { message: parsed.error.issues[0].message });
      return;
    }
    setValue('photoFile', file);
    setValue('photoCleared', false);
    clearErrors();
  }

  function clearPendingPhoto() {
    setValue('photoFile', null);
    setValue('photoCleared', true);
  }

  function onValid(values: SpotFormValues) {
    const updatedName = values.name;
    const updatedReview = values.review;
    const movieFields = { movieId: values.movieId, movieTitle: values.movieTitle || null };

    if (values.photoCleared) {
      // 비우기 = 부모에 의도 전달까지만 (지연 반영) — DB·Storage 반영은 상단 "수정" 제출(updateStoryAction)이 담당
      onFileSelect?.(null);
      onUpdate?.({ name: updatedName, review: updatedReview, rating: values.rating, photoUrl: null, ...movieFields });
      setIsCreationSession(false); // 저장 = 스팟 확정 — 이후 수정→취소는 보기 팝업으로
      setIsEditing(false);
      return;
    }

    let updatedPhotoUrl: string | null | undefined = undefined;
    if (values.photoFile && previewUrl) {
      updatedPhotoUrl = previewUrl;
      handedOffUrlRef.current = previewUrl; // 부모가 이 blob URL을 렌더하므로 revoke 금지
      onFileSelect?.(values.photoFile);
    }

    onUpdate?.({
      name: updatedName,
      review: updatedReview,
      rating: values.rating,
      ...(updatedPhotoUrl !== undefined && { photoUrl: updatedPhotoUrl }),
      ...movieFields,
    });
    setIsCreationSession(false); // 저장 = 스팟 확정 — 이후 수정→취소는 보기 팝업으로
    setIsEditing(false);
  }

  const showPhotoPreview = !!(photoFile || (spot.photoUrl && !photoCleared));
  // 재사용(공유) 스팟은 작품 편집 불가 — 공유 자산이라 한 사용자 편집이 전원에 영향(시딩=공공데이터 출처). 표시만.
  const movieLocked = !!spot.reusedSpotId;
  const errorMessage = errors.photoFile?.message ?? errors.root?.server?.message;

  return (
    <div className="flex flex-col font-sans text-fg">
      {/* 편집 모드 사진 zone */}
      {isEditing && (
        <div className="relative">
          {showPhotoPreview ? (
            <>
              <img
                src={previewUrl ?? spot.photoUrl!}
                alt={nameValue}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 left-2 flex gap-1">
                <label className="px-2 py-1 text-xs rounded bg-black/40 text-white backdrop-blur-sm cursor-pointer hover:bg-black/60">
                  교체
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelect} />
                </label>
                <button
                  type="button"
                  onClick={clearPendingPhoto}
                  className="px-2 py-1 text-xs rounded bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
                >
                  비우기
                </button>
              </div>
            </>
          ) : (
            <label className="flex items-center justify-center h-48 border-b border-border cursor-pointer text-sm text-muted hover:bg-surface2">
              사진 추가
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelect} />
            </label>
          )}
        </div>
      )}

      {/* 보기 모드 사진 zone */}
      {!isEditing && spot.photoUrl && (
        <div className="relative">
          <img src={spot.photoUrl} alt={spot.name} className="w-full h-48 object-cover" />
          {/* bg-card(0378 실측) — 구 bg-white/80은 다크에서 흰 원 + fg 상속 아이콘(밝은 회백)이 겹쳐
              ✕ 미독. 사진 위 부유 원은 SpotFinder 상세 ✕와 동일 상황 — 같은 토큰 페어(bg-card/80+text-fg) */}
          <button
            type="button"
            aria-label="닫기"
            onClick={handleClose}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-card/80 hover:bg-card shadow flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 이름 영역 */}
      <div className="p-4 pb-2">
        {isEditing ? (
          <input
            type="text"
            {...register('name')}
            onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
            className="w-full border border-border rounded px-2 py-1 text-base font-semibold focus:outline-none"
            autoFocus
          />
        ) : (
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-lg font-semibold text-fg">{spot.name}</h3>
            {!spot.photoUrl && (
              <button type="button" aria-label="닫기" onClick={handleClose} className="w-6 h-6 rounded-full bg-surface2 hover:bg-popover flex items-center justify-center flex-shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 주소 */}
      {spot.address && <p className="px-4 pb-2 text-sm text-muted">{spot.address}</p>}

      {/* 리뷰 영역 */}
      {(!readOnly || spot.review) && (
        <>
          <div className="border-t border-border mx-4" />
          <div className="p-4">
            <span className="text-sm font-medium text-fg block mb-2">촬영지 리뷰</span>
            {isEditing ? (
              <textarea
                rows={3}
                {...register('review')}
                placeholder="리뷰를 입력하세요..."
                className="border border-border rounded px-2 py-1 text-sm resize-none focus:outline-none w-full"
              />
            ) : spot.review ? (
              <p className="text-sm text-fg2 whitespace-pre-wrap">{spot.review}</p>
            ) : !readOnly ? (
              <p className="text-sm text-muted cursor-pointer hover:text-fg2" onClick={enterEdit}>
                리뷰 작성...
              </p>
            ) : null}
          </div>
        </>
      )}

      {/* 별점 — per-visit (1~5, 같은 별 재클릭 시 취소). 편집=선택 / 보기=채운 별. rating 없으면 readOnly에서 미표시 */}
      {(!readOnly || spot.rating != null) && (
        <>
          <div className="border-t border-border mx-4" />
          <div className="p-4">
            <span className="text-sm font-medium text-fg block mb-2">별점</span>
            {isEditing ? (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setValue('rating', i === rating ? null : i)}
                    className="p-0.5"
                    aria-label={`${i}점`}
                  >
                    <Star size={22} className={i <= (rating ?? 0) ? 'fill-accent text-accent' : 'text-muted'} />
                  </button>
                ))}
                {rating != null && <span className="ml-1 text-sm text-muted">{rating}점</span>}
              </div>
            ) : spot.rating != null ? (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={18} className={i <= spot.rating! ? 'fill-accent text-accent' : 'text-muted'} />
                ))}
              </div>
            ) : !readOnly ? (
              <p className="text-sm text-muted cursor-pointer hover:text-fg2" onClick={enterEdit}>별점 매기기...</p>
            ) : null}
          </div>
        </>
      )}

      {/* 교통 기준점 — 저장 시 자동 계산 (읽기 전용), 표시 문구는 formatTransit 파생 */}
      {!isEditing && spot.nearestStation && spot.transitMinutes != null && (
        <>
          <div className="border-t border-border mx-4" />
          <div className="p-4">
            <span className="text-sm font-medium text-fg block mb-2">교통 기준점</span>
            <p className="text-sm text-fg2">{formatTransit(spot.nearestStation, spot.transitMinutes, spot.transitMode)}</p>
          </div>
        </>
      )}

      {/* 촬영 작품 */}
      {(!readOnly || (isEditing ? movieId : spot.movieTitle)) && (
        <>
          <div className="border-t border-border mx-4" />
          <div className="p-4 relative">
            <span className="text-sm font-medium text-fg block mb-2">촬영 작품</span>
            {isEditing ? (
              movieLocked ? (
                <div>
                  <div className="flex items-center gap-2 border border-border bg-surface2 rounded px-2 py-1 text-sm text-muted">
                    <span className="flex-1 truncate">{spot.movieTitle ? `${spot.movieTitle}${spot.extraMovieCount ? ` +${spot.extraMovieCount}` : ''}` : '연결된 작품 없음'}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">공유 촬영지의 작품 정보는 수정할 수 없습니다</p>
                </div>
              ) : movieId ? (
                <div className="flex items-center gap-2 border border-border rounded px-2 py-1 text-sm">
                  <span className="flex-1 truncate">{movieTitle}</span>
                  <button type="button" onClick={clearMovie} className="text-muted hover:text-fg2">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={movieQuery}
                    onChange={(e) => handleMovieInput(e.target.value)}
                    placeholder="작품명 검색..."
                    className="border border-border rounded px-2 py-1 text-sm focus:outline-none w-full"
                  />
                  {showDropdown && movieQuery.trim() !== '' && (
                    <ul className="absolute z-10 left-0 right-0 mt-1 bg-popover border border-border rounded shadow text-sm max-h-48 overflow-y-auto">
                      {movieSuggestions.map((m) => (
                        <li
                          key={m.id}
                          onMouseDown={() => selectMovie(m)}
                          className="px-3 py-2 hover:bg-surface2 cursor-pointer flex justify-between"
                        >
                          <span>{m.title}</span>
                          <span className="text-muted text-xs">{m.spotCount}곳</span>
                        </li>
                      ))}
                      {!movieSuggestions.some((m) => normalizeTitle(m.title) === normalizeTitle(movieQuery)) && (
                        <li
                          onMouseDown={handleSubmitNew}
                          className="px-3 py-2 hover:bg-surface2 cursor-pointer text-fg2 border-t border-border"
                        >
                          <span className="text-sm">&apos;{movieQuery.trim()}&apos; 새 작품으로 등록</span>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )
            ) : spot.movieTitle ? (
              <p className="text-sm text-fg2">{spot.movieTitle}{spot.extraMovieCount ? ` +${spot.extraMovieCount}` : ''}</p>
            ) : !readOnly ? (
              <p className="text-sm text-muted cursor-pointer hover:text-fg2" onClick={enterEdit}>
                작품 연결...
              </p>
            ) : null}
          </div>
        </>
      )}

      {/* 저장/취소 (편집 모드) */}
      {isEditing && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            type="button"
            onClick={handleSubmit(onValid)}
            disabled={!nameValue.trim()}
            className="flex-1 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            저장
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="flex-1 py-1.5 rounded-lg text-sm bg-surface2 text-fg2 hover:bg-popover transition-colors disabled:opacity-50"
          >
            취소
          </button>
        </div>
      )}

      {/* 에러 */}
      {errorMessage && <p className="px-4 pb-2 text-xs text-red-600">{errorMessage}</p>}

      {/* 보기 상태 하단: 수정·삭제 */}
      {!readOnly && !isEditing && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            type="button"
            onClick={enterEdit}
            className="flex-1 py-1.5 rounded-lg text-sm bg-surface2 text-fg2 hover:bg-popover transition-colors"
          >
            수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 py-1.5 rounded-lg text-sm text-red-500 border border-red-200 hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
          >
            <Trash2 size={12} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}
