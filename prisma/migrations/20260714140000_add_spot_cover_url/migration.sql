-- 0192 coverUrl: 좌표 기반(KorService2 locationBasedList2) 촬영지 대표 커버 이미지.
-- storySpots 없는 시딩 스팟의 thumbnailUrl(0185) 폴백 소스. nullable — 매칭 실패 스팟은 null(플레이스홀더).
-- 도출 우선순위: 사용자 스토리 사진 ?? coverUrl. 백필 없음(별도 실행). 재실행 안전(IF NOT EXISTS).

ALTER TABLE "spots" ADD COLUMN IF NOT EXISTS "cover_url" TEXT;
