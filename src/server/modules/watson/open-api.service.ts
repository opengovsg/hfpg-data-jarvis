import OpenAI from 'openai'
import { env } from '~/env.mjs'

export const OpenApiClient = new OpenAI({ apiKey: env.OPEN_API_KEY })
