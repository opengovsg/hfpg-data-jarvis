import { z } from 'zod'

export const WatsonErrorResSchema = z.object({
  type: z.enum(['error']),
  message: z.string(),
})

export type WatsonErrorRes = z.infer<typeof WatsonErrorResSchema>

export const ChatHistoryGroups = [
  'Today',
  'Yesterday',
  'Previous 30 Days',
  'Older',
] as const

export type ChatHistoryGroup = (typeof ChatHistoryGroups)[number]
