import { prisma } from '@/lib/prisma'

/**
 * The organization a user is currently "acting as".
 *
 * A user can belong to multiple organizations but only one is active at a time
 * (`isCurrentSession = true`) and access requires approval (`isApprovedMember = true`).
 * This single source of truth replaces the ~11 hand-copied `getActiveOrganization`
 * helpers that used to live in individual API routes (one of which queried a
 * non-existent `isActive` column).
 */
export interface ActiveOrganization {
  organizationId: string
  organizationName: string
  isCurrentSession: boolean
  isAdmin: boolean
}

/**
 * Resolve the active, approved organization for a user, or `null` if they have none.
 */
export async function getActiveOrganization(
  userId: string,
): Promise<ActiveOrganization | null> {
  const [activeOrg] = await prisma.$queryRaw<ActiveOrganization[]>`
    SELECT
      uo."organizationId",
      o."name" AS "organizationName",
      uo."isCurrentSession",
      uo."isAdmin"
    FROM "UserOrganization" uo
    JOIN "Organization" o ON o.id = uo."organizationId"
    WHERE uo."userId" = ${userId}
      AND uo."isCurrentSession" = true
      AND uo."isApprovedMember" = true
    LIMIT 1
  `
  return activeOrg ?? null
}
