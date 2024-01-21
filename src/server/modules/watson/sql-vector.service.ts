import { type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import pgvector from 'pgvector/pg'

export const nearestEmbeddingRes = z.array(
  z.object({
    id: z.number(),
    sqlQuery: z.string(),
    rawQuestion: z.string(),
  }),
)

export class PreviousSqlVectorService {
  constructor(private readonly prisma: PrismaClient) {}

  async storeEmbedding({
    embedding,
    rawQuestion,
    sql,
    prisma = this.prisma,
  }: {
    embedding: number[]
    rawQuestion: string
    sql: string
    prisma?: PrismaClient
  }) {
    await prisma.$executeRaw`INSERT INTO "PreviousSqlQueryToQuestion" ("questionEmbedding", "rawQuestion", "sqlQuery") VALUES (${pgvector.toSql(
      embedding,
    )}::vector,
    ${rawQuestion}, ${sql})`
  }

  async findNearestEmbeddings({
    embedding,
    prisma = this.prisma,
    limit = 5,
  }: {
    embedding: number[]
    prisma?: PrismaClient
    limit?: number
  }) {
    const top5similar =
      await prisma.$queryRaw`SELECT id, "rawQuestion", "sqlQuery"
    FROM "PreviousSqlQueryToQuestion" ORDER BY "questionEmbedding" <-> ${pgvector.toSql(
      embedding,
    )}::vector 
    LIMIT ${limit}`

    return nearestEmbeddingRes.parse(top5similar)
  }
}
