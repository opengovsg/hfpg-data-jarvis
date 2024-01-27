import { type MessageBoxProps } from './MessageBox'
import { atom, useAtom } from 'jotai'
import { v4 as uuidv4 } from 'uuid'

export type ConversationStore = Record<
  number,
  {
    messages: MessageBoxProps[]
    isInputDisabled: boolean
    isGeneratingResponse: boolean
    isCompleted: boolean
    question?: string
    generatedQuery?: string
  }
>

// For use in initial chat window without messages
export const FAKE_CHAT_ID = -1 as const

export const DEFAULT_FAKE_CHAT_ID_STATE = {
  messages: [],
  isInputDisabled: false,
  isGeneratingResponse: false,
  isCompleted: false,
}

/** TODO: This state management is cursed af, redo after hackathon if this becomes a real thing */
/** TODO: conversationStoreAtom should have max number of keys and function like an LRU cache, otherwise you might run into memory errors  */
export const conversationStoreAtom = atom<ConversationStore>({
  [FAKE_CHAT_ID]: DEFAULT_FAKE_CHAT_ID_STATE,
})

export const useGetCurrentConversation = (conversationId: number) => {
  const [conversationStore] = useAtom(conversationStoreAtom)

  const conversation = conversationStore[conversationId]

  if (conversation === undefined) {
    return DEFAULT_FAKE_CHAT_ID_STATE
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
      suggestions,
      isCompleted,
      question,
      generatedQuery,
      completedMsgId,
      isUserUpdate,
    }: {
      conversationId: number
      chunk: string
      isError?: boolean
      completedMsgId?: string
      question?: string
      generatedQuery?: string
      isCompleted?: boolean
      suggestions?: string[]
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
      return
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
              isCompleted,
              generatedQuery,
              question,
              suggestions,
              id: isCompleted ? completedMsgId! : lastChatMessage.id,
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
            isCompleted,
            generatedQuery,
            question,
            suggestions,
            id: isCompleted ? completedMsgId! : lastChatMessage.id,
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

export const tableInfoAtom = atom<null | {
  messageId: string
  generatedQuery: string
  question: string
}>(null)
