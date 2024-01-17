import { z } from 'zod'

export const askQuestionSchema = z.object({
  question: z
    .string()
    .min(10, 'Please enter at least 10 characters')
    .max(200, 'Please phrase your question to be at most 200 characters!'),
  conversationId: z.number(),
})
