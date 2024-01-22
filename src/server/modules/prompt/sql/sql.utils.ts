import { type PrismaClient } from '@prisma/client'
import {
  type QueryColumnsRes,
  type ValidTableName,
  queryColumnsResSchema,
} from './types'
import { prisma } from '~/server/prisma'

export type TableMetadata = {
  tableName: ValidTableName
  // use additionalMetadata to add further information during LLM prompt
  additionalMetadata?: string
}

// TODO: We can consider just getting the migration schema straight to generate this. However, that will result in us needing to piece together subsequent  migrations
// The general idea here is just to simulate creating an entire database table from scratch so that the LLM model is able to understand our schema correctly when we feed it this info for few-shot learning
export const generateCreateTableSchemaFromTableInfo = (
  tableMetadata: TableMetadata,
  columns: QueryColumnsRes,
) => {
  let sqlCreateTableQuery = ''

  if (!!tableMetadata.additionalMetadata) {
    sqlCreateTableQuery.concat(
      `The table ${tableMetadata.tableName} has the following description: \n`,
    )
  }

  sqlCreateTableQuery.concat(`CREATE TABLE ${tableMetadata.tableName} (\n)`)

  // Pretty much copy + paste of `generateTableInfoFromTables` from langchainJS
  for (const [indx, col] of columns.entries()) {
    if (indx > 0) {
      sqlCreateTableQuery += ', '
    }

    if (col.udt_name === 'geometry') {
      continue
    }

    sqlCreateTableQuery += `${col.column_name} ${
      // Special case for POSTGIS columns
      col.data_type
    } ${col.is_nullable ? '' : 'NOT NULL'}`
  }

  sqlCreateTableQuery += ') \n'

  return sqlCreateTableQuery
}

/** TODO: Figure out if semantically incorrect datatypes in the create schema matters.
 * E.G: data_type returned from query is integer, but the correct syntax is INT */
export const getTableColumnMetadata = async (
  tableNames: ValidTableName,
  prisma: PrismaClient,
) => {
  const rawRes = await prisma.$queryRaw`SELECT column_name, data_type, udt_name
  FROM information_schema.columns 
WHERE table_name = ${tableNames};`

  return queryColumnsResSchema.parse(rawRes)
}

/** Copy of `formatSqlResponseToSimpleTableString` from langchain.js */
export const generateSampleDataPrompt = async (
  tableName: ValidTableName,
  columns: QueryColumnsRes,
  nRowsLimit = 3,
) => {
  let sampleDataPrompt = ''

  const validColumnNames = columns
    // omit USER_DEFINED columns as it will raise a prisma error. This is a catch-all for now
    // read https://github.com/prisma/prisma/issues/10448 for more info
    // TODO: find away to add POST_GIS columns in sample data
    .filter((c) => c.data_type !== 'USER-DEFINED')
    .map((col) => col.column_name)

  console.log(
    `SELECT ${validColumnNames.join(
      ',',
    )} FROM ${tableName} LIMIT ${nRowsLimit}`,
  )

  // TODO: We cannot use queryRaw due to https://github.com/prisma/prisma/discussions/12817, investigate if this is vulnerable to sql injections
  // An alternative is to have tableName to prisma object key map so we can just use prisma client to query in the future
  const rawResult = await prisma.$queryRawUnsafe(
    `SELECT ${validColumnNames.join(
      ',',
    )} FROM ${tableName} LIMIT ${nRowsLimit}`,
  )

  if (!!rawResult && Array.isArray(rawResult) && rawResult.length !== 0) {
    for (const oneRow of rawResult) {
      sampleDataPrompt += `${Object.values(oneRow).reduce(
        (completeString, columnValue) => `${completeString} ${columnValue}`,
        '',
      )}\n`
    }
  }

  return {
    sampleDataPrompt,
    query: `SELECT * FROM "${tableName}" LIMIT ${nRowsLimit}`,
  }
}

export const getSimilarSqlStatementsPrompt = (
  sqlStatements: { sqlQuery: string; rawQuestion: string }[],
) => {
  if (sqlStatements.length === 0) return ''

  // Always add this statement so the model knows how to use POSTGIS for proximity search
  const stringBuilder = [
    `Past Question: "Get me the max price of all houses within 5km of Clementi", Sql Query: "
    SELECT
      *
    FROM
      hdb_resale_transaction a
      INNER JOIN (
        SELECT
          Geography (coords) AS coords
        FROM
          searched_address
        WHERE
          searched_address.search_val ILIKE 'clementi'
        LIMIT 1) b ON ST_DWithin (a.coords,
        b.coords,
        5000);"`,
    `Past Question: "Get me the max price of all houses in Clementi", Sql Query: "
    SELECT
      *
    FROM
      hdb_resale_transaction a
      INNER JOIN (
        SELECT
          Geography (coords) AS coords
        FROM
          searched_address
        WHERE
          searched_address.search_val ILIKE 'clementi'
        LIMIT 1) b ON ST_DWithin (a.coords,
        b.coords,
        5000);"`,
  ]

  for (const sqlStatement of sqlStatements) {
    stringBuilder.push(
      `Past Question: "${sqlStatement.rawQuestion}", Sql Query: "${sqlStatement.sqlQuery}"`,
    )
  }

  return `You may use the following SQL statements as a reference for what tables might be available. Use responses to past questions also to guide you:\n\n
  ${stringBuilder.join('\n')}`
}
