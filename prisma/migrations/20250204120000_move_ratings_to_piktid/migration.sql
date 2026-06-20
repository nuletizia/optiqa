-- Get the organization IDs
WITH orgs AS (
  SELECT 
    id,
    name
  FROM "Organization"
  WHERE name IN ('PiktID', 'Nextalia')
)

-- Update the ratings to move them from Nextalia to PiktID
UPDATE "DirectoryRating" dr
SET "organizationId" = (
  SELECT id 
  FROM orgs 
  WHERE name = 'PiktID'
)
WHERE "organizationId" = (
  SELECT id 
  FROM orgs 
  WHERE name = 'Nextalia'
); 