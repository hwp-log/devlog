-- is_draft: 기존 행 = false (멱등)
ALTER TABLE "my_plans"
  ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false;

-- source_nickname: nullable 스냅샷, 백필 불필요 (멱등)
ALTER TABLE "my_plans"
  ADD COLUMN IF NOT EXISTS "source_nickname" VARCHAR(20);
