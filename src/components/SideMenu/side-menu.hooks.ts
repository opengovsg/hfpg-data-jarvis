import { useSetAtom } from 'jotai'
import { useRouter } from 'next/router'
import { useCallback } from 'react'
import { CHAT } from '~/lib/routes'
import {
  conversationStoreAtom,
  FAKE_CHAT_ID,
  DEFAULT_FAKE_CHAT_ID_STATE,
} from '../ChatWindow/chat-window.atoms'

export const useOnClickNewChat = () => {
  const router = useRouter()
  const setConversationStoreState = useSetAtom(conversationStoreAtom)

  const handler = useCallback(() => {
    setConversationStoreState((prev) => ({
      ...prev,
      [FAKE_CHAT_ID]: DEFAULT_FAKE_CHAT_ID_STATE,
    }))
    void router.push(CHAT)
  }, [router, setConversationStoreState])

  return handler
}
