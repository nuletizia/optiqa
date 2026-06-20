-- One-off data migration (2025-02-04): consolidate DirectoryRating rows from a
-- legacy organization into PiktID after two internal orgs were merged.
--
-- The legacy organization's name is redacted as LEGACY_ORG for the public
-- repository. This is a historical migration and a no-op on any fresh database:
-- it only ever matched rows belonging to that specific legacy organization.

-- Get the organization IDs
WITH orgs AS (
  SELECT
    id,
    name
  FROM "Organization"
  WHERE name IN ('PiktID', 'LEGACY_ORG')
)

-- Update the ratings to move them from the legacy org to PiktID
UPDATE "DirectoryRating" dr
SET "organizationId" = (
  SELECT id
  FROM orgs
  WHERE name = 'PiktID'
)
WHERE "organizationId" = (
  SELECT id
  FROM orgs
  WHERE name = 'LEGACY_ORG'
);
