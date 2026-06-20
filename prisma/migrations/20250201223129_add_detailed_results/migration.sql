-- AlterTable
ALTER TABLE "ComparisonResult" ADD COLUMN     "detailedResults" TEXT;

-- CreateIndex
CREATE INDEX "ComparisonResult_userId_idx" ON "ComparisonResult"("userId");
