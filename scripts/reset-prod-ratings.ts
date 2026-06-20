import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.PRODUCTION_DATABASE_URL) {
    throw new Error('PRODUCTION_DATABASE_URL environment variable is required')
  }

  console.log('Connecting to production database...')
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.PRODUCTION_DATABASE_URL
      }
    }
  })

  console.log('Deleting all ratings...')
  await prisma.directoryRating.deleteMany()
  console.log('All ratings have been deleted successfully! 🎉')

  await prisma.$disconnect()
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  }) 