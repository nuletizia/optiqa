import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

/**
 * Grant a user admin + approved-member access to every organization.
 *
 * Usage:
 *   npx tsx scripts/setup-admin.ts user@example.com
 *   ADMIN_EMAIL=user@example.com npx tsx scripts/setup-admin.ts
 */
async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL

  if (!email) {
    console.error('Usage: tsx scripts/setup-admin.ts <email>  (or set ADMIN_EMAIL)')
    process.exit(1)
  }

  const admin = await prisma.user.findFirst({ where: { email } })

  if (!admin) {
    console.error(`User not found for email: ${email}`)
    console.error('The user must sign in at least once before being promoted.')
    process.exit(1)
  }

  const organizations = await prisma.organization.findMany()

  for (const org of organizations) {
    await prisma.$executeRaw`
      INSERT INTO "UserOrganization" (
        "id",
        "userId",
        "organizationId",
        "isApprovedMember",
        "isAdmin",
        "joinedAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${admin.id},
        ${org.id},
        true,
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT ("userId", "organizationId")
      DO UPDATE SET
        "isApprovedMember" = true,
        "isAdmin" = true,
        "updatedAt" = NOW()
    `
    console.log(`Admin access granted for ${org.name}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
