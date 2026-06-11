-- Step 1: NOT NULL 만족용 임시 DEFAULT로 컬럼 추가 (멱등 보장)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nickname" VARCHAR(20) NOT NULL DEFAULT '';

-- Step 2: 기존 유저 백필 — UUID 앞 4자 대문자 조합
UPDATE "users"
SET "nickname" = '여행자_' || upper(substr(id::text, 1, 4))
WHERE "nickname" = '';

-- Step 3: DB default 제거 (이후 INSERT는 앱이 항상 nickname 제공)
ALTER TABLE "users" ALTER COLUMN "nickname" DROP DEFAULT;
