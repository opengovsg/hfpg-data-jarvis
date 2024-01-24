import { useCallback, useEffect } from 'react'
import {
  type WatsonErrorRes,
  WatsonErrorResSchema,
} from '~/server/modules/watson/watson.types'
import { type RouterOutput, trpc } from '~/utils/trpc'
import { type GetWatsonRequest } from '~/utils/watson'
import { useRouter } from 'next/router'
import { FAKE_CHAT_ID, conversationStoreAtom } from './chat-window.atoms'
import { useAtom } from 'jotai'

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
  const utils = trpc.useContext()

  const router = useRouter()

  const createConversation = trpc.watson.createConversation.useMutation()

  const sendQuestion = useCallback(
    async ({
      question,
      conversationId: formConversationId,
    }: {
      question: string
      conversationId: number
    }) => {
      let conversationId: number

      if (formConversationId === FAKE_CHAT_ID) {
        const convo = await createConversation.mutateAsync({ question })
        conversationId = convo.id
      } else {
        conversationId = formConversationId
      }

      const payload: GetWatsonRequest = {
        conversationId,
        question,
      }

      const response = await fetch(`/api/watson`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'text/event-stream',
        },
      })

      await utils.watson.getPastConversations.invalidate()

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

      if (formConversationId === FAKE_CHAT_ID) {
        await router.push(`/chat/${conversationId}`)
      }
    },
    [
      createConversation,
      handleChunk,
      handleError,
      router,
      utils.watson.getPastConversations,
    ],
  )

  return { sendQuestion }
}

export const useSyncConversationStoreWithChatWindowState = ({
  conversationId,
  chatMessages,
}: {
  conversationId: number
  chatMessages: RouterOutput['watson']['getChatMessagesForConversation']
}) => {
  const [conversationStore, setConversationStore] = useAtom(
    conversationStoreAtom,
  )

  useEffect(() => {
    if (!!conversationId && !(conversationId in conversationStore)) {
      setConversationStore((prev) => {
        const prevConvo = prev[conversationId]!

        return {
          ...prev,
          [conversationId]: {
            ...prevConvo,
            messages: chatMessages.map((msg) => ({
              ...msg,
              message: msg.rawMessage,
              id: msg.id.toString(),
            })),
          },
        }
      })
    }
  }, [chatMessages, conversationId, conversationStore, setConversationStore])
}
