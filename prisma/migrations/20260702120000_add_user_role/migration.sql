-- Step 1: enum 생성 (멱등)
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: role 컬럼 추가 — NOT NULL + DEFAULT 'USER'
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';
