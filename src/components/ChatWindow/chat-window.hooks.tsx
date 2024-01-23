import { useCallback } from 'react'
import {
  type WatsonErrorRes,
  WatsonErrorResSchema,
} from '~/server/modules/watson/watson.types'
import {} from '~/utils/watson'

/** Checks if data-stream return is a valid json object of `WatsonErrorRes` then handle it accordingly */
const parseErrorPayload = (
  payload: string,
): { type: 'not-error' } | { type: 'error'; error: WatsonErrorRes } => {
  try {
    const rawPayload = JSON.parse(payload)

    const errorRes = WatsonErrorResSchema.safeParse(rawPayload)

    if (!errorRes.success) {
      return { type: 'not-error' }
    }

    return { type: 'error', error: errorRes.data }
  } catch (e) {
    // assuming all errors no op
    return { type: 'not-error' }
  }
}

export const useCallWatson = ({
  handleChunk,
  handleError,
}: {
  handleError: (error: WatsonErrorRes, question: string) => void
  handleChunk: (chunk: string) => void
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

        if (value === undefined || value.length === 0) {
          continue
        }

        // Check if it is an error, then handle it if it is
        const parsedErrorDetails = parseErrorPayload(value)

        if (parsedErrorDetails.type === 'error') {
          handleError(parsedErrorDetails.error, question)
        } else {
          handleChunk(value ?? '')
        }
      }
    },
    [handleChunk, handleError],
  )

  return response
}
