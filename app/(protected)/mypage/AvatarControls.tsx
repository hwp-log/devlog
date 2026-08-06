'use client';
import { useState, useTransition, useEffect, useRef } from 'react';
import { uploadAvatarImage } from '@/lib/supabase/storage';
import { updateAvatarAction, removeAvatarAction } from './actions';
import { useAvatarPreview } from './AvatarContext';

const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  userId: string;
  currentAvatarUrl: string | null;
}

// 0529: 프로필 사진 조작부 — 계정 설정 카드 안(닉네임과 저장 사이)에 놓인다.
// 검증·업로드·저장 로직은 기존 AvatarForm 그대로, 미리보기 URL만 Context로 공유.
export function AvatarControls({ userId, currentAvatarUrl }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { previewUrl, setPreviewUrl } = useAvatarPreview();
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) {
      setMessage({ type: 'error', text: '파일 크기는 2MB 이하여야 합니다' });
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage({ type: 'error', text: 'jpeg, png, webp만 허용됩니다' });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const url = await uploadAvatarImage(selectedFile, userId);
        const result = await updateAvatarAction(url);
        if (result?.error) {
          setMessage({ type: 'error', text: result.error });
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setMessage({ type: 'success', text: '프로필 사진이 변경되었습니다' });
      } catch (e) {
        setMessage({ type: 'error', text: e instanceof Error ? e.message : '업로드 실패' });
      }
    });
  };

  const handleRemove = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (result?.error) {
        setMessage({ type: 'error', text: result.error });
        return;
      }
      setMessage({ type: 'success', text: '프로필 사진이 제거되었습니다' });
    });
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted mb-1.5 block">프로필 사진</label>
      <div className="flex flex-col gap-2">
        {/* 보조 버튼 — 테두리 전폭, 호버는 무채 명도 반응 */}
        <label className="w-full py-3 rounded-lg border border-field-border text-fg2 text-[15px] font-medium text-center cursor-pointer hover:bg-surface2 transition-colors">
          파일 선택
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleSelect}
            className="hidden"
          />
        </label>
        {selectedFile && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="w-full py-3 rounded-lg border border-field-border text-fg2 text-[15px] font-medium hover:bg-surface2 transition-colors disabled:opacity-50"
          >
            사진 저장
          </button>
        )}
        {currentAvatarUrl && !selectedFile && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="self-start py-3 text-sm text-danger hover:underline disabled:opacity-50"
          >
            제거
          </button>
        )}
      </div>
      {message && (
        <p
          className={`mt-2 text-xs ${
            message.type === 'error' ? 'text-danger' : 'text-emerald-600'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
