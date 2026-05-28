'use client';
import { useState, useTransition } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import type { LocalSpot } from '@/lib/types';
import { uploadSpotPhoto } from '@/app/story/[id]/spots/actions';

type SpotPopupProps = {
  spot: LocalSpot;
  onDelete?: () => void;
  onClose?: () => void;
  readOnly?: boolean;
  onUpdate?: (fields: { name?: string; review?: string; photoUrl?: string | null }) => void;
  onFileSelect?: (file: File | null) => void;
};

export function SpotPopup({ spot, onDelete, onClose, readOnly = false, onUpdate, onFileSelect }: SpotPopupProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(spot.name);
  const [nameInput, setNameInput] = useState(spot.name);
  const [photoUrl, setPhotoUrl] = useState(spot.photoUrl);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [displayReview, setDisplayReview] = useState(spot.review ?? '');
  const [reviewInput, setReviewInput] = useState(spot.review ?? '');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const isTemp = spot.id.startsWith('tmp_');

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isTemp) {
      if (file.size > MAX_SIZE) { setError('파일 크기는 5MB 이하여야 합니다'); return; }
      if (!ALLOWED_TYPES.includes(file.type)) { setError('jpeg, png, webp만 허용됩니다'); return; }
      const previewUrl = URL.createObjectURL(file);
      setPhotoUrl(previewUrl);
      onUpdate?.({ photoUrl: previewUrl });
      onFileSelect?.(file);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    startTransition(async () => {
      const result = await uploadSpotPhoto(spot.id, formData);
      if ('error' in result) { setError(result.error); return; }
      setPhotoUrl(result.photoUrl);
      onUpdate?.({ photoUrl: result.photoUrl });
    });
  }

  function handleSaveName() {
    if (!nameInput.trim()) return;
    setDisplayName(nameInput.trim());
    setIsEditingName(false);
    onUpdate?.({ name: nameInput.trim() });
  }

  function handleSaveReview() {
    setDisplayReview(reviewInput);
    setIsEditingReview(false);
    onUpdate?.({ review: reviewInput });
  }

  return (
    <div className="flex flex-col font-sans text-[#1A1A1A]">
      {/* 1. 사진 zone — readOnly가 아닐 때 항상 표시 (tmp_는 로컬 미리보기, DB spot은 즉시 업로드) */}
      {(photoUrl || !readOnly) && (
        <div className="relative">
          {photoUrl ? (
            <img src={photoUrl} alt={displayName} className="w-full h-48 object-cover" />
          ) : (
            <label
              className={`flex items-center justify-center h-48 border-b border-slate-100 cursor-pointer text-sm text-slate-400 hover:bg-slate-50 transition-colors ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {isPending ? '업로드 중...' : '사진 추가'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
                disabled={isPending}
              />
            </label>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. 이름 영역 */}
      <div className="p-4 pb-2">
        {!readOnly && isEditingName ? (
          <div className="flex gap-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') { setIsEditingName(false); setNameInput(displayName); }
              }}
              className="flex-1 border border-black/20 rounded px-2 py-1 text-sm focus:outline-none"
              autoFocus
            />
            <button type="button" onClick={handleSaveName} disabled={isPending} className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button type="button" onClick={() => { setIsEditingName(false); setNameInput(displayName); }} className="p-1 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-lg font-semibold text-[#1A1A1A]">{displayName}</h3>
            {!readOnly && (
              <button type="button" onClick={() => setIsEditingName(true)} className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0">
                <Pencil size={14} />
              </button>
            )}
            {/* X 버튼: 사진 zone이 없고(readOnly + 사진 없음) 이름 행에 표시 */}
            {!photoUrl && readOnly && (
              <button type="button" onClick={onClose} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. 주소 */}
      {spot.address && <p className="px-4 pb-2 text-sm text-slate-500">{spot.address}</p>}

      {/* 4. 구분선 + 리뷰 — readOnly + 리뷰 없음 = 전체 숨김 */}
      {(!readOnly || displayReview) && (
        <>
          <div className="border-t border-slate-100 mx-4" />
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">촬영지 리뷰</span>
              {!readOnly && !isEditingReview && (
                <button type="button" onClick={() => setIsEditingReview(true)} className="p-1 text-slate-400 hover:text-slate-600">
                  <Pencil size={12} />
                </button>
              )}
            </div>
            {isEditingReview ? (
              <div className="flex flex-col gap-2">
                <textarea
                  rows={3}
                  value={reviewInput}
                  onChange={(e) => setReviewInput(e.target.value)}
                  className="border border-black/20 rounded px-2 py-1 text-sm resize-none focus:outline-none w-full"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={handleSaveReview} disabled={isPending} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 disabled:opacity-50">
                    <Check size={12} /> 저장
                  </button>
                  <button type="button" onClick={() => { setIsEditingReview(false); setReviewInput(displayReview); }} className="text-xs text-slate-400 hover:text-slate-600">
                    취소
                  </button>
                </div>
              </div>
            ) : displayReview ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{displayReview}</p>
            ) : !readOnly ? (
              <p className="text-sm text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setIsEditingReview(true)}>
                리뷰 작성...
              </p>
            ) : null}
          </div>
        </>
      )}

      {/* 5. 에러 + 삭제 */}
      {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}
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
