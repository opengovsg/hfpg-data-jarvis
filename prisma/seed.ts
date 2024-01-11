/**
 * Adds seed data to your db
 *
 * @link https://www.prisma.io/docs/guides/database/seed-database
 */
import { PrismaClient } from '@prisma/client'
import seedResaleFromCsv from './one-time-scripts/seed-hdb-dataset/seed-hdb-dataset'

const prisma = new PrismaClient()

async function main() {
  // Nothing
  await seedResaleFromCsv()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
