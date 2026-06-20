import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seed an initial organization so a fresh install has something to work with.
 * Override the name with SEED_ORGANIZATION (defaults to "Demo").
 *
 * The organization name maps (lowercased) to the S3 prefix where its images live,
 * e.g. an org named "Demo" reads images from the `demo/...` keys in the bucket.
 */
async function main() {
  const orgName = process.env.SEED_ORGANIZATION || 'Demo'

  const organization = await prisma.organization.upsert({
    where: { name: orgName },
    update: {},
    create: { name: orgName },
  })

  console.log(`Seeded organization: ${organization.name} (${organization.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
