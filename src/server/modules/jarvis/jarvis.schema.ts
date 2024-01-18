import { z } from 'zod'

export const askQuestionSchema = z.object({
  question: z.string(),
  conversationId: z.number(),
})
