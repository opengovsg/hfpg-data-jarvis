import { ChatHistoryUser, type PrismaClient } from '@prisma/client'
import pgvector from 'pgvector'
import { z } from 'zod'

const chatHistoryEmbeddingRes = z.array(
  z.object({
    id: z.number(),
    rawMessage: z.string(),
    type: z.nativeEnum(ChatHistoryUser),
  }),
)

export type ChatHistoryEmbeddingRes = z.infer<typeof chatHistoryEmbeddingRes>

/** TODO: For use next time, experimentation on long term memory by getting nearest vectors of QnA asked before caused model to hallucinate1 */
export class ChatHistoryVectorService {
  constructor(private readonly prisma: PrismaClient) {}

  async storeEmbedding({
    embedding,
    rawMessage,
    userType,
    userId,
    prisma = this.prisma,
  }: {
    embedding: number[]
    rawMessage: string
    userType: ChatHistoryUser
    userId: string
    prisma?: PrismaClient
  }) {
    await prisma.$queryRaw`INSERT INTO 
    "ChatHistory" ("messageEmbedding", "rawMessage", "type", "userId") 
    VALUES 
      (
        ${pgvector.toSql(embedding)}::vector,
        ${rawMessage}, 
        cast(${userType} as "ChatHistoryUser"), 
        ${userId}
      );`
  }

  // TODO: Approximate token count of built prompt, then only add in chat history until before the token window
  // FOR MVP we just get limit 5 as a heuristic for STM of LLMS
  async getChatHistory({
    prisma = this.prisma,
    limit = 5,
    userId,
  }: {
    prisma?: PrismaClient
    limit?: number
    userId: string
  }) {
    return await prisma.chatHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      where: { userId },
    })
  }

  async findNearestEmbeddings({
    embedding,
    prisma = this.prisma,
    limit = 10,
    userId,
  }: {
    embedding: number[]
    userId: string
    prisma?: PrismaClient
    limit?: number
  }) {
    const similarMessages =
      await prisma.$queryRaw`SELECT id, "rawMessage", "type"
    FROM "ChatHistory" 
    WHERE "ChatHistory"."userId" = ${userId}
    ORDER BY "messageEmbedding" <-> ${pgvector.toSql(embedding)}::vector
    LIMIT ${limit};`

    return chatHistoryEmbeddingRes.parse(similarMessages)
  }
}
