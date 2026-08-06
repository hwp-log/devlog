'use client';
import { createContext, useContext, useState } from 'react';

// 0529: 아바타 조작(파일 선택·저장)이 오른쪽 계정 설정 카드로 이동하면서
// 왼쪽 표시부(AvatarDisplay)와 '선택 즉시 미리보기'를 공유하기 위한 mypage 지역 상태.
// 공유값은 미리보기 URL 하나 — 파일 검증·업로드·저장 로직은 AvatarControls에 둔다.
interface AvatarPreviewValue {
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
}

const AvatarPreviewContext = createContext<AvatarPreviewValue | null>(null);

export function AvatarPreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  return (
    <AvatarPreviewContext.Provider value={{ previewUrl, setPreviewUrl }}>
      {children}
    </AvatarPreviewContext.Provider>
  );
}

export function useAvatarPreview() {
  const ctx = useContext(AvatarPreviewContext);
  if (!ctx) throw new Error('useAvatarPreview must be used within AvatarPreviewProvider');
  return ctx;
}
