import { z } from 'zod'

export const WatsonErrorResSchema = z.object({
  type: z.enum(['error']),
  message: z.string(),
})

export type WatsonErrorRes = z.infer<typeof WatsonErrorResSchema>
