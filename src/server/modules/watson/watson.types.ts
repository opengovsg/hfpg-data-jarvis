import { z } from 'zod'

export const CompletedStreamingSchema = z.object({
  type: z.enum(['error', 'success']),
  messageId: z.number(),
  message: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  generatedQuery: z.string().optional(),
  question: z.string().optional(),
})

export type CompletedStreamingRes = z.infer<typeof CompletedStreamingSchema>

export const ChatHistoryGroups = [
  'Today',
  'Yesterday',
  'Previous 30 Days',
  'Older',
] as const

export type ChatHistoryGroup = (typeof ChatHistoryGroups)[number]

export const CHAT_HISTORY_GROUP_SORT_ORDER: Record<ChatHistoryGroup, number> = {
  Today: 1,
  Yesterday: 2,
  'Previous 30 Days': 3,
  Older: 4,
}
