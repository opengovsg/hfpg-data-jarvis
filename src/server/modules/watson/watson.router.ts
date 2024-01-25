import { protectedProcedure, router } from '~/server/trpc'
import { z } from 'zod'
import { mapDateToChatHistoryGroup } from './watson.utils'
import _ from 'lodash'
import { prisma } from '~/server/prisma'
import { FAKE_CHAT_ID } from '~/components/ChatWindow/chat-window.atoms'

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
    .query(async ({ ctx: { prisma }, input: { conversationId } }) => {
      // Hack for initial convo
      if (conversationId === FAKE_CHAT_ID) return []

      const conversation = await prisma.conversation.findFirstOrThrow({
        where: { id: conversationId },
      })

      const chatMessages = await prisma.chatMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        select: {
          rawMessage: true,
          type: true,
          suggestions: true,
          id: true,
          createdAt: true,
        },
      })

      return chatMessages
    }),
  updateConversationTitle: protectedProcedure
    .input(z.object({ conversationId: z.number(), title: z.string() }))
    .mutation(async ({ ctx: { prisma }, input: { conversationId, title } }) => {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      })
    }),
})
