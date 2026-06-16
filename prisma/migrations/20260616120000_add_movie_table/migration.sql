-- CreateEnum
CREATE TYPE "MovieStatus" AS ENUM ('APPROVED', 'PENDING');

-- CreateTable
CREATE TABLE "movies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "MovieStatus" NOT NULL DEFAULT 'APPROVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "spots"
  ADD COLUMN IF NOT EXISTS "movie_id" TEXT;

-- CreateIndex
CREATE INDEX "spots_movie_id_idx" ON "spots"("movie_id");

-- AddForeignKey
ALTER TABLE "spots" ADD CONSTRAINT "spots_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
