-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('ONE_WAY', 'ROUND_TRIP');

-- CreateTable
CREATE TABLE "plan_flights" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "trip_type" "TripType" NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "out_origin" CHAR(3) NOT NULL,
    "out_destination" CHAR(3) NOT NULL,
    "out_departs_at" TIMESTAMPTZ(3) NOT NULL,
    "out_arrives_at" TIMESTAMPTZ(3) NOT NULL,
    "out_airline" TEXT NOT NULL,
    "out_flight_no" TEXT NOT NULL,
    "ret_origin" CHAR(3),
    "ret_destination" CHAR(3),
    "ret_departs_at" TIMESTAMPTZ(3),
    "ret_arrives_at" TIMESTAMPTZ(3),
    "ret_airline" TEXT,
    "ret_flight_no" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_flights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_flights_plan_id_key" ON "plan_flights"("plan_id");

-- AddForeignKey
ALTER TABLE "plan_flights" ADD CONSTRAINT "plan_flights_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "my_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

