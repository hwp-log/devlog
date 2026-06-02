-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('KRW', 'USD', 'JPY');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ENTRANCE', 'ETC');

-- CreateTable
CREATE TABLE "my_plans" (
    "id" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "source_story_id" TEXT,
    "title" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'KRW',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "my_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_spots" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_spots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_costs" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "category" "CostCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "my_plans_owner_id_idx" ON "my_plans"("owner_id");

-- CreateIndex
CREATE INDEX "plan_spots_plan_id_idx" ON "plan_spots"("plan_id");

-- CreateIndex
CREATE INDEX "plan_spots_plan_id_day_order_idx" ON "plan_spots"("plan_id", "day", "order");

-- CreateIndex
CREATE INDEX "plan_costs_plan_id_idx" ON "plan_costs"("plan_id");

-- CreateIndex
CREATE INDEX "plan_costs_plan_id_day_idx" ON "plan_costs"("plan_id", "day");

-- AddForeignKey
ALTER TABLE "my_plans" ADD CONSTRAINT "my_plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_spots" ADD CONSTRAINT "plan_spots_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "my_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_costs" ADD CONSTRAINT "plan_costs_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "my_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
