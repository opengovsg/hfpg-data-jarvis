import type { OpenAI } from 'openai'
import { type ChatMessageEmbeddingRes } from '../../jarvis/chat-history.service'

// export const getChatHistoryPrompt = (
//   chatHistory: ChatHistoryEmbeddingRes,
// ): string => {
//   if (chatHistory.length === 0) {
//     return ''
//   }

//   const sb: string[] = []

//   chatHistory.map((line) => {
//     if (line.type === 'AGENT') {
//       sb.push(`AI: ${line.rawMessage}`)
//     } else {
//       sb.push(`HUMAN: ${line.rawMessage}`)
//     }
//   })

//   // TODO: Investigate if this has risk of hallucinating
//   return `----------------
//   The following is the chat history between you, the PostgresQL AI expert, and a human. Use this information to help you in your next response if it is related.

//   Current conversation:
//   ${sb.join('\n')}
//   ----------------
//   `
// }

export const getChatHistoryParams = (
  chatHistory: ChatMessageEmbeddingRes,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
  return chatHistory.map((hist) => ({
    role: hist.type === 'USER' ? 'user' : 'assistant',
    content: hist.rawMessage,
  }))
}
