import { type MessageBoxProps } from './MessageBox'
import { atom, useAtom } from 'jotai'
import { v4 as uuidv4 } from 'uuid'

export type ConversationStore = Record<
  number,
  {
    messages: MessageBoxProps[]
    isInputDisabled: boolean
    isGeneratingResponse: boolean
  }
>

// For use in initial chat window without messages
export const FAKE_CHAT_ID = -1 as const

/** TODO: This state management is cursed af, redo after hackathon if this becomes a real thing */
export const conversationStoreAtom = atom<ConversationStore>({
  [FAKE_CHAT_ID]: {
    messages: [],
    isInputDisabled: false,
    isGeneratingResponse: false,
  },
})

export const useGetCurrentConversation = (conversationId: number) => {
  const [conversationStore] = useAtom(conversationStoreAtom)

  if (conversationId === undefined)
    return { messages: [], isInputDisabled: false, isGeneratingResponse: false }

  const conversation = conversationStore[conversationId]

  if (conversation === undefined) {
    return { messages: [], isInputDisabled: false, isGeneratingResponse: false }
  }

  return conversation
}

export const updateChatMessagesAtom = atom(
  undefined,
  (
    get,
    set,
    {
      conversationId,
      chunk,
      isError,
      isUserUpdate,
    }: {
      conversationId: number
      chunk: string
      isError?: boolean
      isUserUpdate?: boolean
    },
  ) => {
    const conversation = get(conversationStoreAtom)[conversationId]

    // this should never happen
    if (conversation === undefined) {
      throw new Error('Conversation cannot be found!')
    }

    if (!!isUserUpdate) {
      set(conversationStoreAtom, (prev) => ({
        ...prev,
        [conversationId]: {
          ...conversation,
          messages: [
            ...conversation.messages,
            {
              type: 'USER',
              message: chunk,
              id: uuidv4(),
            },
          ],
        },
      }))
      return
    }

    const lastChatMessage =
      conversation.messages[conversation.messages.length - 1]

    // This should never happen
    if (lastChatMessage === undefined) {
      throw new Error(
        'Last index should always be defined when handling chunks',
      )
    }

    // This means we have yet to process first chunk from agent response
    if (lastChatMessage.type === 'USER') {
      set(conversationStoreAtom, (prev) => ({
        ...prev,
        [conversationId]: {
          ...conversation,
          messages: [
            ...conversation.messages,
            {
              type: 'AGENT',
              message: chunk,
              isErrorMessage: isError,
              id: uuidv4(),
            },
          ],
        },
      }))
      return
    }

    // Append to the last chunk in the chat response
    // TODO: Only render latest chat message in the dom instead of re-rendering entire patch on each chunk
    set(conversationStoreAtom, (prev) => ({
      ...prev,
      [conversationId]: {
        ...conversation,
        messages: [
          ...conversation.messages.slice(0, conversation.messages.length - 1),
          {
            ...lastChatMessage,
            message: lastChatMessage.message + chunk,
            isErrorMessage: isError,
          },
        ],
      },
    }))
  },
)

export const updateConversationInputDisabledAtom = atom(
  undefined,
  (
    get,
    set,
    {
      isDisabled,
      conversationId,
    }: { isDisabled: boolean; conversationId: number },
  ) => {
    const conversation = get(conversationStoreAtom)[conversationId]

    // this should never happen
    if (conversation === undefined) {
      throw new Error('Conversation cannot be found!')
    }

    set(conversationStoreAtom, (prev) => ({
      ...prev,
      [conversationId]: { ...conversation, isInputDisabled: isDisabled },
    }))
  },
)

export const updateConversationIsGeneratingResponseAtom = atom(
  undefined,
  (
    get,
    set,
    {
      isGeneratingResponse,
      conversationId,
    }: { isGeneratingResponse: boolean; conversationId: number },
  ) => {
    const conversation = get(conversationStoreAtom)[conversationId]

    // this should never happen
    if (conversation === undefined) {
      throw new Error('Conversation cannot be found!')
    }

    set(conversationStoreAtom, (prev) => ({
      ...prev,
      [conversationId]: {
        ...conversation,
        isGeneratingResponse,
      },
    }))
  },
)
