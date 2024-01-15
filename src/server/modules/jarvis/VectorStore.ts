import '@tensorflow/tfjs'
import { load } from '@tensorflow-models/universal-sentence-encoder'
import { type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import pgvector from 'pgvector/pg'

export const nearestEmbeddingRes = z.array(
  z.object({
    id: z.number(),
    questionEmbedding: z.any(),
    sqlQuery: z.string(),
    rawQuestion: z.string(),
  }),
)

export class VectorStore {
  constructor(private readonly prisma: PrismaClient) {}

  async generateEmbedding(sentence: string) {
    const model = await load()

    const embeddings = await model.embed(sentence)

    return embeddings.arraySync()[0]!
  }

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
      await prisma.$queryRaw`SELECT id, "questionEmbedding"::text, "rawQuestion", "sqlQuery"
    FROM "PreviousSqlQueryToQuestion" ORDER BY "questionEmbedding" <-> ${pgvector.toSql(
      embedding,
    )}::vector 
    LIMIT ${limit}`

    return nearestEmbeddingRes.parse(top5similar)
  }
}
