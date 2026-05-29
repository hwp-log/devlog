'use client';
import { useState, useTransition } from 'react';
import { Trash2, X } from 'lucide-react';
import type { LocalSpot } from '@/lib/types';
import { clearSpotPhoto } from '@/app/story/[id]/spots/actions';

type SpotPopupProps = {
  spot: LocalSpot;
  onDelete?: () => void;
  onClose?: () => void;
  readOnly?: boolean;
  onUpdate?: (fields: { name?: string; review?: string; photoUrl?: string | null }) => void;
  onFileSelect?: (file: File | null) => void;
  initialEditing?: boolean;
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

export function SpotPopup({ spot, onDelete, onClose, readOnly = false, onUpdate, onFileSelect, initialEditing = false }: SpotPopupProps) {
  const isTemp = spot.id.startsWith('tmp_');

  const [isEditing, setIsEditing] = useState(initialEditing);
  const [displayName, setDisplayName] = useState(spot.name);
  const [displayReview, setDisplayReview] = useState(spot.review ?? '');
  const [nameInput, setNameInput] = useState(spot.name);
  const [reviewInput, setReviewInput] = useState(spot.review ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null | undefined>(spot.photoUrl);
  const [originalPhotoUrl] = useState(spot.photoUrl);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [pendingPhotoCleared, setPendingPhotoCleared] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function enterEdit() {
    setNameInput(displayName);
    setReviewInput(displayReview);
    setPendingPhotoFile(null);
    setPendingPhotoCleared(false);
    setIsEditing(true);
  }

  function cancelEdit() {
    if (initialEditing && !displayName.trim()) {
      if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
      onDelete?.();
      onClose?.();
      return;
    }
    setNameInput(displayName);
    setReviewInput(displayReview);
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    setPendingPhotoCleared(false);
    setPhotoUrl(originalPhotoUrl);
    setIsEditing(false);
    setError('');
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) { setError('5MB 이하만 가능합니다'); return; }
    if (!ALLOWED_TYPES.includes(file.type)) { setError('jpeg, png, webp만 허용됩니다'); return; }
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    const preview = URL.createObjectURL(file);
    setPendingPhotoFile(file);
    setPendingPhotoPreview(preview);
    setPendingPhotoCleared(false);
    setError('');
  }

  function clearPendingPhoto() {
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    setPendingPhotoCleared(true);
  }

  function handleSave() {
    if (!nameInput.trim()) return;

    const updatedName = nameInput.trim();
    const updatedReview = reviewInput;

    if (pendingPhotoCleared) {
      if (!isTemp) {
        startTransition(async () => {
          const result = await clearSpotPhoto(spot.id);
          if ('error' in result) { setError(result.error); return; }
          setDisplayName(updatedName);
          setDisplayReview(updatedReview);
          setPhotoUrl(null);
          onUpdate?.({ name: updatedName, review: updatedReview, photoUrl: null });
          setPendingPhotoCleared(false);
          setIsEditing(false);
        });
        return;
      }
      setDisplayName(updatedName);
      setDisplayReview(updatedReview);
      setPhotoUrl(null);
      onFileSelect?.(null);
      onUpdate?.({ name: updatedName, review: updatedReview, photoUrl: null });
      setPendingPhotoCleared(false);
      setIsEditing(false);
      return;
    }

    let updatedPhotoUrl: string | null | undefined = undefined;
    if (pendingPhotoFile && pendingPhotoPreview) {
      setPhotoUrl(pendingPhotoPreview);
      updatedPhotoUrl = pendingPhotoPreview;
      onFileSelect?.(pendingPhotoFile);
    }

    setDisplayName(updatedName);
    setDisplayReview(updatedReview);
    onUpdate?.({
      name: updatedName,
      review: updatedReview,
      ...(updatedPhotoUrl !== undefined && { photoUrl: updatedPhotoUrl }),
    });
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    setIsEditing(false);
  }

  const showPhotoPreview = !!(pendingPhotoFile || (photoUrl && !pendingPhotoCleared));

  return (
    <div className="flex flex-col font-sans text-[#1A1A1A]">
      {/* 편집 모드 사진 zone */}
      {isEditing && (
        <div className="relative">
          {showPhotoPreview ? (
            <>
              <img
                src={pendingPhotoPreview ?? photoUrl!}
                alt={nameInput}
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
      {!isEditing && photoUrl && (
        <div className="relative">
          <img src={photoUrl} alt={displayName} className="w-full h-48 object-cover" />
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
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
            className="w-full border border-black/20 rounded px-2 py-1 text-base font-semibold focus:outline-none"
            autoFocus
          />
        ) : (
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-lg font-semibold text-[#1A1A1A]">{displayName}</h3>
            {!readOnly && (
              <button type="button" onClick={enterEdit} className="px-2.5 py-1 text-xs rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0">
                수정
              </button>
            )}
            {!photoUrl && (
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
      {(!readOnly || displayReview) && (
        <>
          <div className="border-t border-slate-100 mx-4" />
          <div className="p-4">
            <span className="text-sm font-medium text-slate-700 block mb-2">촬영지 리뷰</span>
            {isEditing ? (
              <textarea
                rows={3}
                value={reviewInput}
                onChange={(e) => setReviewInput(e.target.value)}
                placeholder="리뷰를 입력하세요..."
                className="border border-black/20 rounded px-2 py-1 text-sm resize-none focus:outline-none w-full"
              />
            ) : displayReview ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{displayReview}</p>
            ) : !readOnly ? (
              <p className="text-sm text-slate-400 cursor-pointer hover:text-slate-600" onClick={enterEdit}>
                리뷰 작성...
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
            onClick={handleSave}
            disabled={isPending || !nameInput.trim()}
            className="flex-1 py-1.5 rounded-lg text-sm font-medium bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={isPending}
            className="flex-1 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
        </div>
      )}

      {/* 에러 */}
      {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}

      {/* 마커 삭제 */}
      {!readOnly && (
        <div className="px-4 pb-4">
          <button type="button" onClick={onDelete} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors">
            <Trash2 size={12} /> 마커 삭제
          </button>
        </div>
      )}
    </div>
  );
}
