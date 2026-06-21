-- Add optional human-facing batch labels to ComparisonSet.
-- With job-id storage, S3 paths are immutable ({org}/jobs/{jobId}/a|b), so the
-- batch display names live here as metadata instead of in the folder names.
ALTER TABLE "ComparisonSet" ADD COLUMN "batchALabel" TEXT;
ALTER TABLE "ComparisonSet" ADD COLUMN "batchBLabel" TEXT;
