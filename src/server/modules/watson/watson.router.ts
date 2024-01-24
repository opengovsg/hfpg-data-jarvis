import { protectedProcedure, router } from '~/server/trpc'
import { PreviousSqlVectorService } from './sql-vector.service'
import { z } from 'zod'
import { generateEmbeddingFromOpenAi } from './vector.utils'

export const watsonRouter = router({
  getConversation: protectedProcedure.query(
    async ({ ctx: { prisma, user } }) => {
      // TODO: Change this when we support multiple conversations
      let conversation = await prisma.conversation.findFirst({
        where: { userId: user.id },
      })

      // for now just create a conversation if user does not have convo
      if (conversation === null) {
        conversation = await prisma.conversation.create({
          data: { title: '', userId: user.id },
        })
      }

      const chatMessages = await prisma.chatMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        select: {
          rawMessage: true,
          type: true,
          id: true,
          createdAt: true,
        },
      })

      return { conversationId: conversation.id, chatMessages }
    },
  ),
  // TODO: Extend this to be dataset agnostic in the future. It will ideally take an input of the datasets we support
  getSuggestions: protectedProcedure
    .input(z.object({ question: z.string() }))
    .query(async ({ ctx: { prisma }, input: { question } }) => {
      const service = new PreviousSqlVectorService(prisma)

      // TODO: Make generate embedding hit some kind of redis cache of question <> embedding mapping so we dont get charged for double calls
      const embedding = await generateEmbeddingFromOpenAi(question)

      const nearestQuestions = await service.findNearestEmbeddings({
        embedding,
        limit: 4,
      })

      return nearestQuestions.map((qn) => qn.rawQuestion)
    }),
})
