-- 0183 S1 (expand): story_spots + spot_movies 조인 추가.
-- 기존 spots 컬럼(story_id/movie_id/order/review/photo_url) 유지 — S4에서 제거(contract).
-- 무손실: 기존 spot 1행 → story_spots 1행 + (movie_id 있으면) spot_movies 1행. 병합 없음.

-- 1) Spot.story_id nullable화 (공유 준비 — 제거는 S4. FK/CASCADE/인덱스 불변)
ALTER TABLE "spots" ALTER COLUMN "story_id" DROP NOT NULL;

-- 2) story_spots: 스토리↔장소 (per-visit: order/review/photo_url 이관처)
CREATE TABLE "story_spots" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "spot_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "review" TEXT,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_spots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "story_spots_story_id_spot_id_key" ON "story_spots"("story_id", "spot_id");
CREATE INDEX "story_spots_story_id_order_idx" ON "story_spots"("story_id", "order");
CREATE INDEX "story_spots_spot_id_idx" ON "story_spots"("spot_id");
ALTER TABLE "story_spots" ADD CONSTRAINT "story_spots_story_id_fkey"
  FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_spots" ADD CONSTRAINT "story_spots_spot_id_fkey"
  FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) spot_movies: 장소↔작품 다대다
CREATE TABLE "spot_movies" (
    "id" TEXT NOT NULL,
    "spot_id" TEXT NOT NULL,
    "movie_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spot_movies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "spot_movies_spot_id_movie_id_key" ON "spot_movies"("spot_id", "movie_id");
CREATE INDEX "spot_movies_movie_id_idx" ON "spot_movies"("movie_id");
CREATE INDEX "spot_movies_spot_id_idx" ON "spot_movies"("spot_id");
ALTER TABLE "spot_movies" ADD CONSTRAINT "spot_movies_spot_id_fkey"
  FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spot_movies" ADD CONSTRAINT "spot_movies_movie_id_fkey"
  FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) 백필 (1:1 무병합). id는 cuid 불필요 → gen_random_uuid()::text (PG15 core). ON CONFLICT = 재실행 안전
INSERT INTO "story_spots" ("id","story_id","spot_id","order","review","photo_url","created_at","updated_at")
SELECT gen_random_uuid()::text, s."story_id", s."id", s."order", s."review", s."photo_url", s."created_at", CURRENT_TIMESTAMP
FROM "spots" s
WHERE s."story_id" IS NOT NULL
ON CONFLICT ("story_id","spot_id") DO NOTHING;

-- 승인 반영 1: created_at = s.created_at 승계 (대표 작품 "최신 연결" 정렬 결정성 보장)
INSERT INTO "spot_movies" ("id","spot_id","movie_id","created_at")
SELECT gen_random_uuid()::text, s."id", s."movie_id", s."created_at"
FROM "spots" s
WHERE s."movie_id" IS NOT NULL
ON CONFLICT ("spot_id","movie_id") DO NOTHING;
