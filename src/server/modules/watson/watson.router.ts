import { protectedProcedure, router } from '~/server/trpc'

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
})
