import { type Prisma } from '@prisma/client'
import { PreviousSqlVectorService } from '~/server/modules/jarvis/sql-vector.service'
import { generateEmbeddingFromOpenApi } from '~/server/modules/jarvis/vector.utils'
import { prisma } from '~/server/prisma'

export const seedQueries = async () => {
  const data: Prisma.PreviousSqlQueryToQuestionCreateInput[] = [
    {
      rawQuestion: 'What was the average price of flats sold?',
      sqlQuery: `SELECT AVG("resale_price") FROM hdb_resale_transaction;`,
    },
    {
      rawQuestion: `When did the most expensive transaction in Clementi occur?`,
      sqlQuery: `SELECT
          transaction_date
        FROM
          hdb_resale_transaction
        WHERE
          town = 'CLEMENTI'
        ORDER BY
          resale_price DESC
        LIMIT 1;`,
    },
    {
      rawQuestion:
        'What was the average lease duration (in months) of flats sold?',
      sqlQuery: `SELECT AVG(remaining_lease_in_months) FROM hdb_resale_transaction;`,
    },
    {
      rawQuestion: 'What was the price of the most expensive flat sold?',
      sqlQuery: `SELECT MAX("resale_price") FROM hdb_resale_transaction;`,
    },
    {
      rawQuestion: 'What was the price of the cheapest flat sold in 2023?',
      sqlQuery: `SELECT
      MIN("resale_price")
    FROM
      hdb_resale_transaction
    WHERE
      EXTRACT(YEAR FROM "transaction_date") = '2023';`,
    },
    {
      rawQuestion: 'Where was the smallest flat sold?',
      sqlQuery: `SELECT
      *
    FROM
      hdb_resale_transaction
    ORDER BY
      "floorAreaSquareFeet" ASC
    LIMIT 1;`,
    },
    {
      rawQuestion:
        'What is the price per square foot for 3 bedroom flats in bishan, toa payoh and ang mo kio in 2023?',
      sqlQuery: `SELECT
      AVG("resale_price" / ("floor_area_square_feet" * 10.764)) AS averagePerSquareFoot
    FROM
      hdb_resale_transaction
    WHERE
      EXTRACT(YEAR FROM "transaction_date") = '2023'
      AND UPPER(town) = ANY (ARRAY ['BISHAN', 'TOA PAYOH', 'ANG MO KIO'])
      AND UPPER("flat_type")
      LIKE '3 ROOM';`,
    },
    {
      rawQuestion:
        'What is the month over month average price trend for 3-bedroom flats in woodlands?',
      sqlQuery: `SELECT
      transactionMonth,
      transactionYear,
      averageMonthlyPrice,
      (averageMonthlyPrice - lag(averageMonthlyPrice) OVER (ORDER BY transactionMonth,
          transactionYear)) / lag(averageMonthlyPrice) OVER (ORDER BY transactionMonth,
        transactionYear) AS monthOnMonthPriceChange
    FROM (
      SELECT
        EXTRACT(MONTH FROM "transaction_date") AS transactionMonth,
        EXTRACT(YEAR FROM "transaction_date") AS transactionYear,
        town,
        AVG("resale_price") AS averageMonthlyPrice
      FROM
        hdb_resale_transaction
      WHERE
        UPPER(town)
        LIKE 'WOODLANDS'
        AND UPPER("flat_type") = '3 ROOM'
      GROUP BY
        town,
        EXTRACT(MONTH FROM "transaction_date"),
        EXTRACT(YEAR FROM "transaction_date")) sub
    ORDER BY
      transactionMonth,
      transactionYear;`,
    },
    {
      rawQuestion:
        'What is the distance between bishan and ang mo kio?',
      sqlQuery: `SELECT
      ST_DistanceSphere(
        (SELECT 
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) 
         FROM 
            hdb_resale_transaction 
         WHERE 
            town = 'BISHAN'
         LIMIT 1),
        (SELECT 
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) 
         FROM 
            hdb_resale_transaction 
         WHERE 
            town = 'ANG MO KIO' 
         LIMIT 1)
    ) / 1000 AS distance_in_km;`,
    },
  ]

  const vectorStore = new PreviousSqlVectorService(prisma)

  await Promise.all(
    data.map(async (d) => {
      console.log(`generating embedding for ${d.rawQuestion}`)
      const embedding = await generateEmbeddingFromOpenApi(d.rawQuestion)

      await vectorStore.storeEmbedding({
        embedding,
        rawQuestion: d.rawQuestion,
        sql: d.sqlQuery,
      })

      console.log(`stored embedding for ${d.rawQuestion}`)
    }),
  )
}
