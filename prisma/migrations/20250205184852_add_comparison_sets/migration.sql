-- CreateTable
CREATE TABLE "ComparisonSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "directoryV1" TEXT NOT NULL,
    "directoryV2" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ComparisonSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComparisonSet_organizationId_idx" ON "ComparisonSet"("organizationId");

-- CreateIndex
CREATE INDEX "ComparisonSet_createdById_idx" ON "ComparisonSet"("createdById");

-- AddForeignKey
ALTER TABLE "ComparisonSet" ADD CONSTRAINT "ComparisonSet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonSet" ADD CONSTRAINT "ComparisonSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
