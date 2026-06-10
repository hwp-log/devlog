-- AlterTable: my_plans에 is_public(NOT NULL DEFAULT false), source_plan_id(nullable) 추가
ALTER TABLE "my_plans" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "my_plans" ADD COLUMN "source_plan_id" TEXT;

-- CreateTable: plan_likes (likes 테이블 구조 미러)
CREATE TABLE "plan_likes" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_likes_plan_id_user_id_key" ON "plan_likes"("plan_id", "user_id");

-- AddForeignKey
ALTER TABLE "plan_likes" ADD CONSTRAINT "plan_likes_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "my_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_likes" ADD CONSTRAINT "plan_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
