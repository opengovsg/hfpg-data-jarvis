import OpenAI from 'openai'
import { env } from '~/env.mjs'

export const OpenAIClient = new OpenAI({ apiKey: env.OPEN_AI_KEY })
