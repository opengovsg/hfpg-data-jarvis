import { useCallback, useEffect } from 'react'
import {
  type WatsonErrorRes,
  WatsonErrorResSchema,
} from '~/server/modules/watson/watson.types'
import { trpc } from '~/utils/trpc'
import { type GetWatsonRequest } from '~/utils/watson'
import { useRouter } from 'next/router'
import {
  FAKE_CHAT_ID,
  conversationStoreAtom,
  updateChatMessagesAtom,
  updateConversationInputDisabledAtom,
  updateConversationIsGeneratingResponseAtom,
} from './chat-window.atoms'
import { useAtom, useSetAtom } from 'jotai'
import { type MessageBoxProps } from './MessageBox'

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
  handleError,
}: {
  handleError: (question: string) => void
}) => {
  const utils = trpc.useContext()

  const router = useRouter()

  const createConversation = trpc.watson.createConversation.useMutation()

  const setConversationStore = useSetAtom(conversationStoreAtom)
  const setIsInputDisabled = useSetAtom(updateConversationInputDisabledAtom)
  const updateChatMessages = useSetAtom(updateChatMessagesAtom)
  const setIsGenerating = useSetAtom(updateConversationIsGeneratingResponseAtom)

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

        // We clone FAKE_CHAT_ID here which will have the user's question at this point
        // This logic is only needed during the initial new chat phase where we dont want to create a conversation in the backend
        setConversationStore((prev) => ({
          ...prev,
          [conversationId]: prev[FAKE_CHAT_ID]!,
        }))

        // Take the fake conversation id and clone the state
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

        // Only set false on first defined chunk
        setIsGenerating({ conversationId, isGeneratingResponse: false })

        // Check if it is an error, then handle it if it is
        const parsedErrorDetails = parseErrorPayload(value)

        if (parsedErrorDetails.type === 'error') {
          updateChatMessages({
            conversationId,
            chunk: parsedErrorDetails.error.message,
            isError: true,
          })
          handleError(question)
        } else {
          updateChatMessages({ conversationId, chunk: value, isError: false })
        }
      }

      setIsInputDisabled({ conversationId, isDisabled: false })

      if (formConversationId === FAKE_CHAT_ID) {
        await router.push(`/chat/${conversationId}`)
      }
    },
    [
      createConversation,
      handleError,
      router,
      setConversationStore,
      setIsGenerating,
      setIsInputDisabled,
      updateChatMessages,
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
  chatMessages: MessageBoxProps[]
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
            messages: chatMessages,
          },
        }
      })
    }
  }, [chatMessages, conversationId, conversationStore, setConversationStore])
}
