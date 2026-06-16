-- RLS 활성화
ALTER TABLE "movies" ENABLE ROW LEVEL SECURITY;

-- SELECT: 비로그인 포함 누구나 영화 조회 가능 (자동완성용)
CREATE POLICY "movies_select" ON "movies"
FOR SELECT TO public
USING (true);

-- INSERT / UPDATE / DELETE는 0107+ 에서 추가 예정
