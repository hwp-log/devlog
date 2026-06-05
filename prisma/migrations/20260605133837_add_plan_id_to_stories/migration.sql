-- AlterTable
ALTER TABLE "stories" ADD COLUMN "plan_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stories_plan_id_key" ON "stories"("plan_id");

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "my_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
