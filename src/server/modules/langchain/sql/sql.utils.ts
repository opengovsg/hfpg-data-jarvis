import { type PrismaClient } from '@prisma/client'
import {
  type QueryColumnsRes,
  type ValidTableName,
  queryColumnsResSchema,
} from './types'
import { prisma } from '~/server/prisma'

// TODO: We can consider just getting the migration schema straight to generate this. However, that will result in us needing to piece together subsequent  migrations
// The general idea here is just to simulate creating an entire database table from scratch so that the LLM model is able to understand our schema correctly when we feed it this info for few-shot learning
export const generateCreateTableSchemaFromTableInfo = (
  tableName: ValidTableName,
  columns: QueryColumnsRes,
) => {
  let sqlCreateTableQuery = `CREATE TABLE ${tableName} (\n)`

  // Pretty much copy + paste of `generateTableInfoFromTables` from langchainJS
  for (const [indx, col] of columns.entries()) {
    if (indx > 0) {
      sqlCreateTableQuery += ', '
    }

    sqlCreateTableQuery += `${col.column_name} ${col.data_type} ${
      col.is_nullable ? '' : 'NOT NULL'
    }`
  }

  sqlCreateTableQuery += ') \n'

  return sqlCreateTableQuery
}

/** TODO: Figure out if semantically incorrect datatypes in the create schema matters.
 * E.G: data_type returned from query is integer, but the correct syntax is INT */
export const getTableColumnMetadata = async (
  tableName: ValidTableName,
  prisma: PrismaClient,
) => {
  const rawRes = await prisma.$queryRaw`SELECT column_name, data_type
  FROM information_schema.columns 
WHERE table_name = ${tableName};`

  return queryColumnsResSchema.parse(rawRes)
}

/** Copy of `formatSqlResponseToSimpleTableString` from langchain.js */
export const generateSampleDataPrompt = async (
  tableName: ValidTableName,
  nRowsLimit = 3,
) => {
  let sampleDataPrompt = ''

  // TODO: We cannot use queryRaw due to https://github.com/prisma/prisma/discussions/12817, investigate if this is vulnerable to sql injections
  // An alternative is to have tableName to prisma object key map so we can just use prisma client to query in the future
  const rawResult = await prisma.$queryRawUnsafe(
    `SELECT * FROM "HdbResaleTransaction" LIMIT ${nRowsLimit}`,
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

  const stringBuilder = []

  for (const sqlStatement of sqlStatements) {
    stringBuilder.push(
      `Past Question: ${sqlStatement.rawQuestion}, Sql Query: ${sqlStatement.sqlQuery}`,
    )
  }

  return `You may use the following SQL statements as a reference for what tables might be available. Use responses to past questions also to guide you:\n\n
  ${stringBuilder.join('\n')}`
}
