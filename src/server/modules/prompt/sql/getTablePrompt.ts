import { type PrismaClient } from '@prisma/client'
import {
  type TableMetadata,
  generateCreateTableSchemaFromTableInfo,
  generateSampleDataPrompt,
  getTableColumnMetadata,
} from './sql.utils'

/**
 * This function was created as the LangChains `SqlDatabase` interface only works with typeorm database connectors.
 *
 * We follow their best practices document commented in `getTableInfo` here: https://arxiv.org/abs/2204.00498
 *
 * The main idea is to feed in the database schema along with N sample rows for few-shot learning.
 *
 * TODO: Investigate limitations if `getTableInfo` outputs string that goes beyond token limit of models we are using
 * */
export async function getTableInfo(
  // TODO: Extend this to work with multiple tables in the future. For POC we just need one table
  targetTables: TableMetadata[],
  prisma: PrismaClient,
) {
  const createTableSchemaPrompt = ''

  for (const targetTable of targetTables) {
    const tableColumnsMetadata = await getTableColumnMetadata(
      targetTable.tableName,
      prisma,
    )

    const createTableInfo = generateCreateTableSchemaFromTableInfo(
      targetTable,
      tableColumnsMetadata,
    )

    const { sampleDataPrompt, query } = await generateSampleDataPrompt(
      targetTable.tableName,
      tableColumnsMetadata,
    )

    createTableSchemaPrompt.concat(createTableInfo, query, sampleDataPrompt)
  }

  return createTableSchemaPrompt
}
