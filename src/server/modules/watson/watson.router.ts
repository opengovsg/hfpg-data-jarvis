import { protectedProcedure, router } from '~/server/trpc'
import { z } from 'zod'
import { mapDateToChatHistoryGroup } from './watson.utils'
import _ from 'lodash'
import { prisma, readonlyWatsonPrismaClient } from '~/server/prisma'
import { FAKE_CHAT_ID } from '~/components/ChatWindow/chat-window.atoms'
import { TRPCError } from '@trpc/server'

const tableDataQuerySchema = z.array(z.record(z.unknown()))

// TODO: Add RBAC to this whole layer in the future
export const watsonRouter = router({
  getPastConversations: protectedProcedure.query(
    async ({ ctx: { prisma, user } }) => {
      const pastConversations = await prisma.conversation.findMany({
        where: { userId: user.id },
        select: { id: true, title: true, latestChatMessageAt: true },
      })

      const convosWithBuckets = pastConversations.map((convo) => ({
        ...convo,
        lastUpdatedAtBucket: mapDateToChatHistoryGroup(
          convo.latestChatMessageAt,
        ),
        latestChatMessageAt: convo.latestChatMessageAt,
      }))

      return _.groupBy(
        convosWithBuckets,
        ({ lastUpdatedAtBucket }) => lastUpdatedAtBucket,
      )
    },
  ),
  createConversation: protectedProcedure
    .input(z.object({ question: z.string() }))
    .mutation(async ({ ctx: { user }, input: { question } }) => {
      return await prisma.conversation.create({
        data: { userId: user.id, title: question.slice(0, 30) },
        select: { id: true },
      })
    }),
  getChatMessagesForConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(
      async ({
        ctx: {
          prisma,
          user: { id: userId },
        },
        input: { conversationId },
      }) => {
        // Hack for initial convo
        if (conversationId === FAKE_CHAT_ID) return []

        const conversation = await prisma.conversation.findFirstOrThrow({
          where: { id: conversationId, userId },
        })

        const chatMessages = await prisma.chatMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
          select: {
            rawMessage: true,
            type: true,
            suggestions: true,
            sqlQuery: true,
            badResponseReason: true,
            isGoodResponse: true,
            id: true,
            createdAt: true,
          },
        })

        return chatMessages
      },
    ),
  updateConversationTitle: protectedProcedure
    .input(z.object({ conversationId: z.number(), title: z.string() }))
    .mutation(
      async ({
        ctx: {
          prisma,
          user: { id: userId },
        },
        input: { conversationId, title },
      }) => {
        await prisma.conversation.update({
          where: { id: conversationId, userId },
          data: { title },
        })
      },
    ),
  // TODO: Add rate limiting in the future
  // TODO: Add RBAC in the future, technically anyone can rate aynones responses atm
  rateResponse: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        isGoodResponse: z.boolean(),
        badResponseReason: z.string().max(300).optional(),
      }),
    )
    .mutation(
      async ({
        ctx: {
          prisma,
          user: { id: requestUserId },
        },
        input: { messageId, isGoodResponse, badResponseReason },
      }) => {
        const { conversationId } = await prisma.chatMessage.findFirstOrThrow({
          where: { id: messageId },
          select: { conversationId: true },
        })

        const { userId } = await prisma.conversation.findFirstOrThrow({
          where: { id: conversationId },
          select: { userId: true },
        })

        if (userId !== requestUserId) {
          throw new TRPCError({ code: 'UNAUTHORIZED' })
        }

        await prisma.chatMessage.update({
          where: { id: messageId },
          data: {
            isGoodResponse,
            badResponseReason,
          },
        })
      },
    ),
  getTable: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        limit: z.number(),
        offset: z.number(),
      }),
    )
    .query(async ({ ctx: { user }, input: { messageId, limit, offset } }) => {
      const { sqlQuery } = await prisma.chatMessage.findFirstOrThrow({
        where: { id: messageId, conversation: { userId: user.id } },
        select: {
          sqlQuery: true,
        },
      })

      if (sqlQuery === null)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'sql query not defined for this agent message',
        })

      // TODO: check for security vulerabilities
      // TODO: check how to improve perf for this, this is super hacky MVP query that might not use indexes etc
      const res = await readonlyWatsonPrismaClient.$queryRawUnsafe(
        `SELECT * FROM (${sqlQuery.replaceAll(';', '')}) a LIMIT ${
          // we add a + 1 here so that we know whether we can navigate to next page
          limit + 1
        } OFFSET ${offset * limit}`,
      )

      const tableRecords = tableDataQuerySchema.safeParse(res)

      if (!tableRecords.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'sql query response is of unexpected format',
        })
      }

      return {
        data: tableRecords.data.slice(0, 10),
        hasNext: tableRecords.data.length > 10,
      }
    }),
})
