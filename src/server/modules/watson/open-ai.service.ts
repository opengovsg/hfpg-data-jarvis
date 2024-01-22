import OpenAI from 'openai'
import { env } from '~/env.mjs'

export const OpenAiClient = new OpenAI({ apiKey: env.OPEN_API_KEY })
