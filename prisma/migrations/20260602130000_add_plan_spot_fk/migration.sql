-- AlterTable
ALTER TABLE "plan_costs" ADD COLUMN     "plan_spot_id" TEXT;

-- AddForeignKey
ALTER TABLE "plan_costs" ADD CONSTRAINT "plan_costs_plan_spot_id_fkey" FOREIGN KEY ("plan_spot_id") REFERENCES "plan_spots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
