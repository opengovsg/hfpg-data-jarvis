import { type Prisma } from '@prisma/client'
import { VectorStore } from '~/server/modules/jarvis/VectorStore'
import { prisma } from '~/server/prisma'

export const seedQueries = async () => {
  const data: Prisma.PreviousSqlQueryToQuestionCreateInput[] = [
    {
      rawQuestion: 'What was the average price of flats sold?',
      sqlQuery: `SELECT AVG("resale_price") FROM "HdbResaleTransaction";`,
    },
    {
      rawQuestion:
        'What was the average lease duration (in months) of flats sold?',
      sqlQuery: `SELECT AVG("remainingLeaseInMonths") FROM "HdbResaleTransaction";`,
    },
    {
      rawQuestion: 'What was the price of the most expensive flat sold?',
      sqlQuery: `SELECT MAX("resalePrice") FROM "HdbResaleTransaction";`,
    },
    {
      rawQuestion: 'What was the price of the cheapest flat sold in 2023?',
      sqlQuery: `SELECT
      MIN("resalePrice")
    FROM
      "HdbResaleTransaction"
    WHERE
      EXTRACT(YEAR FROM "transactionDate") = '2023';`,
    },
    {
      rawQuestion: 'Where was the smallest flat sold?',
      sqlQuery: `SELECT
      *
    FROM
      "HdbResaleTransaction"
    ORDER BY
      "floorAreaSquareFeet" ASC
    LIMIT 1;`,
    },
    {
      rawQuestion:
        'What is the price per square foot for 3 bedroom flats in bishan, toa payoh and ang mo kio in 2023?',
      sqlQuery: `SELECT
      AVG("resalePrice" / ("floorAreaSquareFeet" * 10.764)) AS averagePerSquareFoot
    FROM
      "HdbResaleTransaction"
    WHERE
      EXTRACT(YEAR FROM "transactionDate") = '2023'
      AND UPPER(town) = ANY (ARRAY ['BISHAN', 'TOA PAYOH', 'ANG MO KIO'])
      AND UPPER("flatType")
      LIKE '3 ROOM';`,
    },
    {
      rawQuestion:
        'What is the month over month average price trend for 3-bedroom flats in woodlands?',
      sqlQuery: `SELECT
      averageMonthlyPrice,
      (averageMonthlyPrice - lag(averageMonthlyPrice) OVER (ORDER BY transactionMonth)) / lag(averageMonthlyPrice) OVER (ORDER BY transactionMonth) AS monthOnMonthPriceChange
    FROM (
      SELECT
        EXTRACT(MONTH FROM "transactionDate") AS transactionMonth,
        town,
        AVG("resalePrice") AS averageMonthlyPrice
      FROM
        "HdbResaleTransaction"
      WHERE
        UPPER(town)
        LIKE 'WOODLANDS'
        AND UPPER("flatType") = '3 ROOM'
      GROUP BY
        town,
        EXTRACT(MONTH FROM "transactionDate")) sub;`,
    },
  ]

  const vectorStore = new VectorStore(prisma)

  await Promise.all(
    data.map(async (d) => {
      console.log(`generating embedding for ${d.rawQuestion}`)
      const embedding = await vectorStore.generateEmbedding(d.rawQuestion)

      await vectorStore.storeEmbedding({
        embedding,
        rawQuestion: d.rawQuestion,
        sql: d.sqlQuery,
      })

      console.log(`stored embedding for ${d.rawQuestion}`)
    }),
  )
}
