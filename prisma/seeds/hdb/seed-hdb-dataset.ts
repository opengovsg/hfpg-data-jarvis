import { type Prisma } from '@prisma/client'
import { z } from 'zod'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import Papa from 'papaparse'
import { prisma } from '~/server/prisma'

const filePaths = ['fixtures/resale-flats-after-jan-2017-w-latlong.csv']

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
  remaining_lease: z.string(),
  resale_price: z.coerce.number(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
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

  return years + months
}

type RawQueryCreateDataInput = Omit<
  Prisma.HdbResaleTransactionCreateInput,
  'transactionDate'
> & {
  latitude: number
  longitude: number
  transactionDate: Date
}

const parseRawDataRowIntoCreateInput = (
  rawRow: RawCsvResaleFlatShape,
): RawQueryCreateDataInput => {
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

  const remainingLeaseInMonths = processRemainingLeaseIntoTimeInMonths(
    rawRow.remaining_lease,
  )

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
    streetName: rawRow.street_name.replace("'", "''"),
    town: rawRow.town,
    transactionDate: rawRow.month,
    latitude: rawRow.latitude,
    longitude: rawRow.longitude,
  }
}

const createManyHdbTransactionWithRawQuery = async (
  rows: RawQueryCreateDataInput[],
) => {
  await prisma.$queryRawUnsafe(`INSERT INTO hdb_resale_transaction 
  (transaction_date, town, longitude, latitude, block, street_name, storey_range_begin, storey_range_end, floor_area_square_feet, flat_model, flat_type, lease_commence_year, remaining_lease_in_months, resale_price, coords)
  VALUES
  ${rows
    .map(
      (data) =>
        `('${data.transactionDate.toISOString()}', '${data.town}', ${
          data.longitude
        }, ${data.latitude}, '${data.block}', '${data.streetName}', '${
          data.storeyRangeBegin
        }', '${data.storeyRangeEnd}', '${data.floorAreaSquareFeet}', '${
          data.flatModel
        }', '${data.flatType}', '${data.leaseCommenceYear}', '${
          data.remainingLeaseInMonths
        }', '${data.resalePrice}', (ST_SetSRID(ST_MakePoint(${
          data.longitude
        }, ${data.latitude}), 4326)))`,
    )
    .join(',\n')};`)
}

const main = async () => {
  for (const filePath of filePaths) {
    const createDataInput: RawQueryCreateDataInput[] = []
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
          await createManyHdbTransactionWithRawQuery(createDataInput)
          // clear array after creation
          createDataInput.length = 0
        }
      },
      complete: async () => {
        if (createDataInput.length > 0) {
          await createManyHdbTransactionWithRawQuery(createDataInput)
        }

        console.log('>> completed seeding db')
      },
    })
  }
}

export default main
