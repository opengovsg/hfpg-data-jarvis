import { useCallback } from 'react'
import {} from '~/utils/watson'

export const useCallWatson = ({
  handleChunk,
}: {
  handleChunk?: (chunk: string) => void
}) => {
  const response = useCallback(
    async ({
      question,
      conversationId,
    }: {
      question: string
      conversationId: number
    }) => {
      const response = await fetch(`/api/watson`, {
        method: 'POST',
        body: JSON.stringify({ question, conversationId }),
        headers: {
          'Content-Type': 'text/event-stream',
        },
      })

      if (response.body === null) {
        return
      }

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader()

      while (true) {
        const { value, done } = await reader.read()

        if (done) break

        handleChunk?.(value)
      }
    },
    [handleChunk],
  )

  return response
}
