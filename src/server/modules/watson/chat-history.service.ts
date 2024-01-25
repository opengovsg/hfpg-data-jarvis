import { ChatMessageUser, Prisma, type PrismaClient } from '@prisma/client'
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
    suggestions = [],
    userType,
    prisma = this.prisma,
  }: {
    embedding?: number[]
    rawMessage: string
    userType: ChatMessageUser
    suggestions?: string[]
    conversationId: number
    prisma?: PrismaClient
  }) {
    if (!!embedding) {
      await prisma.$queryRaw`INSERT INTO 
    "ChatMessage" ("messageEmbedding", "rawMessage", "type", "conversationId", "suggestions") 
    VALUES 
      (
        ${pgvector.toSql(embedding)}::vector,
        ${rawMessage}, 
        cast(${userType} as "ChatMessageUser"), 
        ${conversationId},
        ARRAY[${suggestions.length > 0 ? Prisma.join(suggestions, ',') : ''}]
      );`
    } else {
      await prisma.chatMessage.create({
        data: { conversationId, type: userType, rawMessage, suggestions },
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
    limit = 5,
    conversationId,
  }: {
    embedding: number[]
    conversationId: number
    prisma?: PrismaClient
    limit?: number
  }): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const similarAgentMessages =
      await prisma.$queryRaw`SELECT id, "rawMessage", "type"
    FROM "ChatMessage" 
    WHERE "ChatMessage"."conversationId" = ${conversationId} AND "type" = 'AGENT'
    ORDER BY "messageEmbedding" <-> ${pgvector.toSql(embedding)}::vector 
    LIMIT ${limit};`

    const similarUserMessages =
      await prisma.$queryRaw`SELECT id, "rawMessage", "type"
    FROM "ChatMessage" 
    WHERE "ChatMessage"."conversationId" = ${conversationId} AND "type" = 'USER'
    ORDER BY "messageEmbedding" <-> ${pgvector.toSql(embedding)}::vector 
    LIMIT ${limit};`

    const agentRes = chatMessageEmbeddingRes.parse(similarAgentMessages)
    const userRes = chatMessageEmbeddingRes.parse(similarUserMessages)

    return [...agentRes, ...userRes].map((msg) => ({
      role: msg.type === 'AGENT' ? 'assistant' : 'user',
      content: msg.rawMessage,
    }))
  }
}
