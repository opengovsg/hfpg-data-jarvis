import { type Prisma } from '@prisma/client'
import { z } from 'zod'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import Papa from 'papaparse'
import { prisma } from '~/server/prisma'
import { differenceInMonths } from 'date-fns'

const filePaths = [
  'fixtures/rental_flats.csv'
]

const rawCsvRentalFlatSchema = z.object({
  rent_approval_date: z.coerce.date(),
  town: z.string(),
  block: z.string(),
  street_name: z.string(),
  flat_type: z.string(),
  monthly_rent: z.coerce.number(),
})

type RawCsvRentalFlatShape = z.infer<typeof rawCsvRentalFlatSchema>

const parseRawDataRowIntoCreateInput = (
  rawRow: RawCsvRentalFlatShape,
): Prisma.HdbRentalTransactionCreateInput => {

  return {
    rent_approval_date: rawRow.rent_approval_date,
    town: rawRow.town,
    block: rawRow.block,
    street_name: rawRow.street_name,
    flat_type: rawRow.flat_type,
    monthly_rent: rawRow.monthly_rent,
  }
}

const main = async () => {
  for (const filePath of filePaths) {
    const createDataInput: Prisma.HdbRentalTransactionCreateInput[] = []
    let counter = 1
    const file = createReadStream(path.resolve(__dirname, filePath))

    Papa.parse(file, {
      header: true,
      step: async (row) => {
        const parsedRawRow = rawCsvRentalFlatSchema.safeParse(row.data)

        if (!parsedRawRow.success) {
          console.log('CSV of unexpected format', parsedRawRow.error)
          return
        }

        try {
          createDataInput.push(
            parseRawDataRowIntoCreateInput(parsedRawRow.data),
          )
        } catch (e) {
          let message = 'Unexpected error'

          if (e instanceof Error) {
            message = e.message
          }

          console.log(
            `>> Error faced processing row ${counter}, message: ${message}`,
          )
        }

        counter++

        if (createDataInput.length === 100) {
          console.log('>> creating database inputs....')
          await prisma.hdbRentalTransaction.createMany({
            data: createDataInput,
          })

          // clear array after creation
          createDataInput.length = 0
        }
      },
      complete: async () => {
        if (createDataInput.length > 0) {
          await prisma.hdbRentalTransaction.createMany({
            data: createDataInput,
          })
          createDataInput.length = 0
        }

        console.log('>> completed seeding Rental db')
      },
    })
  }
}

export default main
