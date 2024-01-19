import { z } from 'zod'

export const UNABLE_TO_FIND_ANSWER_MESSAGE = `I am unable to find the answer, please try again.`

export const getWatsonRequestSchema = z.object({
  question: z.string(),
  conversationId: z.number(),
})
