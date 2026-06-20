/*
  Warnings:

  - Added the required column `organizationId` to the `DirectoryRating` table without a default value. This is not possible if the table is not empty.

*/
-- First, add the column as nullable
ALTER TABLE "DirectoryRating" ADD COLUMN "organizationId" TEXT;

-- Update existing ratings with the organization ID from the user's current organization
UPDATE "DirectoryRating" dr
SET "organizationId" = (
  SELECT "organizationId"
  FROM "User"
  WHERE "User"."id" = dr."userId"
  LIMIT 1
);

-- Make the column required
ALTER TABLE "DirectoryRating" ALTER COLUMN "organizationId" SET NOT NULL;

-- Create index
CREATE INDEX "DirectoryRating_organizationId_idx" ON "DirectoryRating"("organizationId");

-- Add foreign key constraint
ALTER TABLE "DirectoryRating" ADD CONSTRAINT "DirectoryRating_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
