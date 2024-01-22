import { z } from 'zod'

export const queryColumnsResSchema = z.array(
  z.object({
    column_name: z.string(),
    data_type: z.string(),
    udt_name: z.string(),
    is_nullable: z.preprocess((val) => val !== 'NO', z.boolean()),
  }),
)

export type QueryColumnsRes = z.infer<typeof queryColumnsResSchema>

// TODO: Add test to verify table names exist, right now we manually sync these table names with our migration.
export const VALID_TABLE_NAMES = [
  'hdb_resale_transaction',
  'searched_address',
] as const

export type ValidTableName = (typeof VALID_TABLE_NAMES)[number]
