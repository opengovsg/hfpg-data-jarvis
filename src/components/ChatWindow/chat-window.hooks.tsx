import { useCallback, useEffect } from 'react'
import {
  type CompletedStreamingRes,
  CompletedStreamingSchema,
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
import { CHAT } from '~/lib/routes'

/** Checks if data-stream return is a valid json object of `WatsonErrorRes` then handle it accordingly */
const parseCompletedRes = (
  payload: string,
):
  | { type: 'not-completed' }
  | { type: 'completed'; data: CompletedStreamingRes } => {
  try {
    const rawPayload = JSON.parse(payload)

    const completedRes = CompletedStreamingSchema.safeParse(rawPayload)

    if (!completedRes.success) {
      return { type: 'not-completed' }
    }

    return { type: 'completed', data: completedRes.data }
  } catch (e) {
    // assuming all errors no op
    return { type: 'not-completed' }
  }
}

export const useCallWatson = () => {
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
      const isFakeChat = formConversationId === FAKE_CHAT_ID

      if (isFakeChat) {
        const convo = await createConversation.mutateAsync({ question })
        conversationId = convo.id

        // We clone FAKE_CHAT_ID here which will have the user's question at this point
        // This logic is only needed during the initial new chat phase where we dont want to create a conversation in the backend
        setConversationStore((prev) => ({
          ...prev,
          [conversationId]: prev[FAKE_CHAT_ID]!,
        }))

        await router.push(`${CHAT}/${conversationId}`)
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

        setIsGenerating({ conversationId, isGeneratingResponse: false })

        // Check if it is an error, then handle it if it is
        const parsedCompletedRes = parseCompletedRes(value)

        if (parsedCompletedRes.type === 'completed') {
          setIsGenerating({ conversationId, isGeneratingResponse: false })

          if (parsedCompletedRes.data.type === 'error') {
            updateChatMessages({
              conversationId,
              suggestions: parsedCompletedRes.data.suggestions,
              chunk: parsedCompletedRes.data.message ?? '',
              completedMsgId: parsedCompletedRes.data.messageId.toString(),
              isCompleted: true,
              isError: true,
            })
          } else {
            updateChatMessages({
              conversationId,
              completedMsgId: parsedCompletedRes.data.messageId.toString(),
              isCompleted: true,
              chunk: '',
            })
          }
          break
        } else {
          updateChatMessages({ conversationId, chunk: value, isError: false })
        }
      }

      await utils.watson.getPastConversations.invalidate()
      setIsInputDisabled({ conversationId, isDisabled: false })
    },
    [
      createConversation,
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
