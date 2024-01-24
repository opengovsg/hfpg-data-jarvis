import { HStack, Icon, Text } from '@chakra-ui/react'
import { SIDE_MENU_ITEM_PX } from './sidemenu.constants'
import { BsPencilSquare } from 'react-icons/bs'
import { useRouter } from 'next/router'
import { useSetAtom } from 'jotai'
import {
  DEFAULT_FAKE_CHAT_ID_STATE,
  FAKE_CHAT_ID,
  conversationStoreAtom,
} from '../ChatWindow/chat-window.atoms'
import { CHAT } from '~/lib/routes'

export const SidebarHeader = () => {
  const router = useRouter()
  const setConversationStoreState = useSetAtom(conversationStoreAtom)
  return (
    <HStack
      justify="space-between"
      w="full"
      borderRadius={4}
      py={4}
      mb={4}
      color="white"
      _hover={{ bgColor: 'whiteAlpha.200', cursor: 'pointer' }}
      _active={{ bgColor: 'whiteAlpha.100' }}
      px={SIDE_MENU_ITEM_PX}
      onClick={async () => {
        setConversationStoreState((prev) => ({
          ...prev,
          [FAKE_CHAT_ID]: DEFAULT_FAKE_CHAT_ID_STATE,
        }))
        void router.push(CHAT)
      }}
    >
      <Text textStyle="subhead-2">New Chat</Text>
      <Icon as={BsPencilSquare} />
    </HStack>
  )
}
