-- RLS 활성화
ALTER TABLE "spot_movies" ENABLE ROW LEVEL SECURITY;

-- SELECT: 비로그인 포함 누구나 조회 가능 (SpotFinder 집계용) — movies-rls 대칭
CREATE POLICY "spot_movies_select" ON "spot_movies"
FOR SELECT TO public
USING (true);

-- INSERT / UPDATE / DELETE는 이후 사이클에서 추가 예정 (앱은 Prisma로 RLS 우회 기록)
-- 공유 스팟에 여러 작성자가 작품을 매다는 구조라 소유자 단일화가 어려움 → movies 관례(쓰기 유예) 따름
