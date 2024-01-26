import { z } from 'zod'
import {
  MAX_QUESTION_LENGTH,
  MIN_QUESTION_LENGTH,
} from '~/server/modules/watson/watson.constants'

export const UNABLE_TO_FIND_ANSWER_MESSAGE = `I am unable to find the answer, please try again.`

export const getWatsonRequestSchema = z.object({
  question: z
    .string()
    .min(MIN_QUESTION_LENGTH, { message: 'Enter at least 10 characters' })
    .max(MAX_QUESTION_LENGTH, { message: 'Enter 1,000 characters or less' }),
  conversationId: z.number(),
})

export type GetWatsonRequest = z.infer<typeof getWatsonRequestSchema>
