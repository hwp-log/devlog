'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, X } from 'lucide-react';
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
  onUpdate?: (fields: { name?: string; review?: string; photoUrl?: string | null; movieId?: string | null; movieTitle?: string | null }) => void;
  onFileSelect?: (file: File | null) => void;
  initialEditing?: boolean;
  initialNameInput?: string;
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

// 검증의 단일 소스 — 파일 검증(크기·타입)과 이름 필수 가드를 전부 스키마로 흡수
const spotFormSchema = z.object({
  name: z.string().trim().min(1),
  review: z.string(),
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

export function SpotPopup({ spot, onDelete, onClose, readOnly = false, onUpdate, onFileSelect, initialEditing = false, initialNameInput }: SpotPopupProps) {
  // UI 상태만 useState 잔류 (movieSuggestions는 서버 검색 캐시 — Query 프로바이더 부재로 잔류)
  const [isEditing, setIsEditing] = useState(initialEditing);
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
      movieQuery: '',
      movieId: spot.movieId ?? null,
      movieTitle: spot.movieTitle ?? '',
      photoFile: null,
      photoCleared: false,
    },
  });

  const nameValue = watch('name');
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

  function cancelEdit() {
    if (initialEditing && !spot.name.trim()) {
      onDelete?.();
      onClose?.();
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
      onUpdate?.({ name: updatedName, review: updatedReview, photoUrl: null, ...movieFields });
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
      ...(updatedPhotoUrl !== undefined && { photoUrl: updatedPhotoUrl }),
      ...movieFields,
    });
    setIsEditing(false);
  }

  const showPhotoPreview = !!(photoFile || (spot.photoUrl && !photoCleared));
  const errorMessage = errors.photoFile?.message ?? errors.root?.server?.message;

  return (
    <div className="flex flex-col font-sans text-[#1A1A1A]">
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
            <label className="flex items-center justify-center h-48 border-b border-slate-100 cursor-pointer text-sm text-slate-400 hover:bg-slate-50">
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
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition-colors"
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
            className="w-full border border-black/20 rounded px-2 py-1 text-base font-semibold focus:outline-none"
            autoFocus
          />
        ) : (
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-lg font-semibold text-[#1A1A1A]">{spot.name}</h3>
            {!spot.photoUrl && (
              <button type="button" onClick={onClose} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 주소 */}
      {spot.address && <p className="px-4 pb-2 text-sm text-slate-500">{spot.address}</p>}

      {/* 리뷰 영역 */}
      {(!readOnly || spot.review) && (
        <>
          <div className="border-t border-slate-100 mx-4" />
          <div className="p-4">
            <span className="text-sm font-medium text-slate-700 block mb-2">촬영지 리뷰</span>
            {isEditing ? (
              <textarea
                rows={3}
                {...register('review')}
                placeholder="리뷰를 입력하세요..."
                className="border border-black/20 rounded px-2 py-1 text-sm resize-none focus:outline-none w-full"
              />
            ) : spot.review ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{spot.review}</p>
            ) : !readOnly ? (
              <p className="text-sm text-slate-400 cursor-pointer hover:text-slate-600" onClick={enterEdit}>
                리뷰 작성...
              </p>
            ) : null}
          </div>
        </>
      )}

      {/* 교통 기준점 — 저장 시 자동 계산 (읽기 전용), 표시 문구는 formatTransit 파생 */}
      {!isEditing && spot.nearestStation && spot.transitMinutes != null && (
        <>
          <div className="border-t border-slate-100 mx-4" />
          <div className="p-4">
            <span className="text-sm font-medium text-slate-700 block mb-2">교통 기준점</span>
            <p className="text-sm text-slate-600">{formatTransit(spot.nearestStation, spot.transitMinutes)}</p>
          </div>
        </>
      )}

      {/* 촬영 작품 */}
      {(!readOnly || (isEditing ? movieId : spot.movieId)) && (
        <>
          <div className="border-t border-slate-100 mx-4" />
          <div className="p-4 relative">
            <span className="text-sm font-medium text-slate-700 block mb-2">촬영 작품</span>
            {isEditing ? (
              movieId ? (
                <div className="flex items-center gap-2 border border-black/20 rounded px-2 py-1 text-sm">
                  <span className="flex-1 truncate">{movieTitle}</span>
                  <button type="button" onClick={clearMovie} className="text-slate-400 hover:text-slate-600">
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
                    className="border border-black/20 rounded px-2 py-1 text-sm focus:outline-none w-full"
                  />
                  {showDropdown && movieQuery.trim() !== '' && (
                    <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-black/10 rounded shadow text-sm max-h-48 overflow-y-auto">
                      {movieSuggestions.map((m) => (
                        <li
                          key={m.id}
                          onMouseDown={() => selectMovie(m)}
                          className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex justify-between"
                        >
                          <span>{m.title}</span>
                          <span className="text-slate-400 text-xs">{m.spotCount}곳</span>
                        </li>
                      ))}
                      {!movieSuggestions.some((m) => normalizeTitle(m.title) === normalizeTitle(movieQuery)) && (
                        <li
                          onMouseDown={handleSubmitNew}
                          className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-slate-600 border-t border-slate-100"
                        >
                          <span className="text-sm">&apos;{movieQuery.trim()}&apos; 새 작품으로 등록</span>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )
            ) : spot.movieId ? (
              <p className="text-sm text-slate-600">{spot.movieTitle}</p>
            ) : !readOnly ? (
              <p className="text-sm text-slate-400 cursor-pointer hover:text-slate-600" onClick={enterEdit}>
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
            className="flex-1 py-1.5 rounded-lg text-sm font-medium bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            저장
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="flex-1 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
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
            className="flex-1 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
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
