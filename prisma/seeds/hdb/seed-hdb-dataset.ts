import { type Prisma } from '@prisma/client'
import { z } from 'zod'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import Papa from 'papaparse'
import { prisma } from '~/server/prisma'
import { differenceInMonths } from 'date-fns'

const filePaths = [
  'fixtures/resale-flats-after-jan-2017-w-latlong.csv',
  'fixtures/resale-flats-1990-1999.csv',
  'fixtures/resale-flats-2000-2012.csv',
  'fixtures/resale-flats-2012-2014.csv',
  'fixtures/resale-flats-2015-2016.csv',
]

const rawCsvResaleFlatSchema = z.object({
  month: z.coerce.date(),
  town: z.string(),
  flat_type: z.string(),
  block: z.string(),
  street_name: z.string(),
  storey_range: z.string(),
  floor_area_sqm: z.coerce.number(),
  flat_model: z.string(),
  lease_commence_date: z.coerce.number(),
  remaining_lease: z.string().optional(),
  resale_price: z.coerce.number(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
})

type RawCsvResaleFlatShape = z.infer<typeof rawCsvResaleFlatSchema>

const processRemainingLeaseIntoTimeInMonths = (remainingLease: string) => {
  const years = parseInt(
    remainingLease.slice(0, remainingLease.indexOf('years')).trim(),
  )

  if (isNaN(years)) {
    throw new Error('Expected number for years')
  }

  let months = 0

  if (remainingLease.indexOf('months') !== -1) {
    const parsedMonths = parseInt(
      remainingLease
        .slice(
          remainingLease.indexOf('years') + 5,
          remainingLease.indexOf('months'),
        )
        .trim(),
    )

    if (isNaN(parsedMonths)) {
      throw new Error('Expected number for months, received other datatype')
    }

    months = Number(parsedMonths)
  }

  return years * 12 + months
}

const parseRawDataRowIntoCreateInput = (
  rawRow: RawCsvResaleFlatShape,
): Prisma.HdbResaleTransactionCreateInput => {
  const [storeyRangeBegin, storeyRangeEnd] = rawRow.storey_range
    .split('TO')
    .map((s) => {
      const range = parseInt(s.trim())

      if (isNaN(range)) {
        throw new Error(
          `Expected number, received a string for range: ${range}`,
        )
      }

      return Number(range)
    })

  if (storeyRangeBegin == undefined || storeyRangeEnd == undefined) {
    throw new Error('Could not parse storey range')
  }

  // best approximate number of months
  let remainingLeaseInMonths =
    99 * 12 -
    differenceInMonths(
      new Date(rawRow.month),
      new Date(rawRow.lease_commence_date, 1, 1),
    )

  if (!!rawRow.remaining_lease) {
    remainingLeaseInMonths = processRemainingLeaseIntoTimeInMonths(
      rawRow.remaining_lease,
    )
  }

  return {
    block: rawRow.block,
    flatModel: rawRow.flat_model,
    flatType: rawRow.flat_type,
    floorAreaSquareFeet: rawRow.floor_area_sqm,
    leaseCommenceYear: rawRow.lease_commence_date,
    remainingLeaseInMonths: remainingLeaseInMonths,
    resalePrice: rawRow.resale_price,
    storeyRangeBegin,
    storeyRangeEnd,
    streetName: rawRow.street_name,
    town: rawRow.town,
    transactionDate: rawRow.month,
    latitude: rawRow.latitude,
    longitude: rawRow.longitude,
  }
}

const main = async () => {
  for (const filePath of filePaths) {
    const createDataInput: Prisma.HdbResaleTransactionCreateInput[] = []
    let counter = 1
    const file = createReadStream(path.resolve(__dirname, filePath))

    Papa.parse(file, {
      header: true,
      step: async (row) => {
        const parsedRawRow = rawCsvResaleFlatSchema.safeParse(row.data)

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
          await prisma.hdbResaleTransaction.createMany({
            data: createDataInput,
          })

          // clear array after creation
          createDataInput.length = 0
        }
      },
      complete: async () => {
        if (createDataInput.length > 0) {
          await prisma.hdbResaleTransaction.createMany({
            data: createDataInput,
          })
          createDataInput.length = 0
        }

        console.log('>> completed seeding db')
      },
    })
  }
}

export default main
