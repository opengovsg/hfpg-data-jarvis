/**
 * Adds seed data to your db
 *
 * @link https://www.prisma.io/docs/guides/database/seed-database
 */
import { PrismaClient } from '@prisma/client'
import seedResaleFromCsv from './seeds/hdb/seed-hdb-dataset'
import { seedQueries } from './seeds/queries/seed-queries'

const prisma = new PrismaClient()

async function main() {
  // Nothing
  await seedResaleFromCsv()
  await seedQueries()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
