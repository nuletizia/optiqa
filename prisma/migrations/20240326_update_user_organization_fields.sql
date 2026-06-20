-- Add new columns
ALTER TABLE "UserOrganization" 
ADD COLUMN "isApprovedMember" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isCurrentSession" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing data
UPDATE "UserOrganization"
SET "isApprovedMember" = "isActive",
    "isCurrentSession" = "isActive";

-- Drop old unique constraint
DROP INDEX IF EXISTS "one_active_org_per_user";

-- Create new unique constraint for current session
CREATE UNIQUE INDEX "one_active_session_per_user" ON "UserOrganization" ("userId") WHERE ("isCurrentSession" = true);

-- Update trigger function
CREATE OR REPLACE FUNCTION sync_user_active_status()
RETURNS trigger AS $$
BEGIN
  -- Update user's active status based on whether they have any approved memberships
  UPDATE "User"
  SET "isActive" = EXISTS (
    SELECT 1
    FROM "UserOrganization"
    WHERE "UserOrganization"."userId" = NEW."userId"
    AND "UserOrganization"."isApprovedMember" = true
  )
  WHERE "User"."id" = NEW."userId";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old column
ALTER TABLE "UserOrganization"
DROP COLUMN "isActive";

-- Add comment explaining the changes
COMMENT ON TABLE "UserOrganization" IS 'Updated schema to split isActive into isApprovedMember and isCurrentSession'; 