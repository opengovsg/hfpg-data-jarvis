import { ChatMessageUser, type PrismaClient } from '@prisma/client'
import pgvector from 'pgvector'
import { z } from 'zod'

const chatMessageEmbeddingRes = z.array(
  z.object({
    id: z.number(),
    rawMessage: z.string(),
    type: z.nativeEnum(ChatMessageUser),
  }),
)

export type ChatMessageEmbeddingRes = z.infer<typeof chatMessageEmbeddingRes>

/** TODO: For use next time, experimentation on long term memory by getting nearest vectors of QnA asked before caused model to hallucinate1 */
export class ChatMessageVectorService {
  constructor(private readonly prisma: PrismaClient) {}

  async storeMessage({
    embedding,
    rawMessage,
    conversationId,
    userType,
    prisma = this.prisma,
  }: {
    embedding?: number[]
    rawMessage: string
    userType: ChatMessageUser
    conversationId: number
    prisma?: PrismaClient
  }) {
    if (!!embedding) {
      await prisma.$queryRaw`INSERT INTO 
    "ChatMessage" ("messageEmbedding", "rawMessage", "type", "conversationId") 
    VALUES 
      (
        ${pgvector.toSql(embedding)}::vector,
        ${rawMessage}, 
        cast(${userType} as "ChatMessageUser"), 
        ${conversationId}
      );`
    } else {
      await prisma.chatMessage.create({
        data: { conversationId, type: userType, rawMessage },
      })
    }
  }

  // TODO: Approximate token count of built prompt, then only add in chat history until before the token window
  // FOR MVP we just get limit 5 as a heuristic for STM of LLMS
  async getChatMessage({
    prisma = this.prisma,
    limit = 5,
    conversationId,
  }: {
    prisma?: PrismaClient
    limit?: number
    conversationId: number
  }) {
    return await prisma.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      where: { conversationId },
    })
  }

  async findNearestEmbeddings({
    embedding,
    prisma = this.prisma,
    limit = 10,
    conversationId,
  }: {
    embedding: number[]
    conversationId: number
    prisma?: PrismaClient
    limit?: number
  }) {
    const similarMessages =
      await prisma.$queryRaw`SELECT id, "rawMessage", "type"
    FROM "ChatMessage" 
    WHERE "ChatMessage"."conversationId" = ${conversationId}
    ORDER BY "messageEmbedding" <-> ${pgvector.toSql(embedding)}::vector
    LIMIT ${limit};`

    return chatMessageEmbeddingRes.parse(similarMessages)
  }
}
