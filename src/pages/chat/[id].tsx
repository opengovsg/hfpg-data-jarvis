import {
  Box,
  Grid,
  IconButton,
  InputGroup,
  Text,
  VStack,
  Textarea,
  Skeleton,
  HStack,
  SkeletonCircle,
} from '@chakra-ui/react'
import { useAtomValue } from 'jotai'
import _ from 'lodash'
import router from 'next/router'
import { BiSend } from 'react-icons/bi'
import { EnforceLoginStatePageWrapper } from '~/components/AuthWrappers'
import ChatWindow from '~/components/ChatWindow/ChatWindow'
import {
  FAKE_CHAT_ID,
  conversationStoreAtom,
} from '~/components/ChatWindow/chat-window.atoms'
import { SideMenu } from '~/components/SideMenu/SideMenu'
import { type NextPageWithLayout } from '~/lib/types'
import { trpc } from '~/utils/trpc'

const Chat: NextPageWithLayout = () => {
  const conversationId =
    router.query.id === undefined ? FAKE_CHAT_ID : Number(router.query.id)

  return (
    <EnforceLoginStatePageWrapper>
      <Grid gridTemplateColumns={`260px 1fr`} h="100vh" overflowY="hidden">
        <SideMenu />

        <ChatWindowSuspenseWrapper
          conversationId={conversationId}
          key={conversationId}
        />
      </Grid>
    </EnforceLoginStatePageWrapper>
  )
}

const LoadingChatWindow = () => {
  return (
    <Grid
      gridTemplateRows={`1fr min-content`}
      h="100%"
      w="100%"
      px={8}
      bgColor="base.canvas.brand-subtle"
      overflowY="hidden"
    >
      <VStack spacing={6} mt={6} overflowY="scroll">
        {[...Array(6)].map((key) => (
          <HStack key={key} w="100%" spacing={4} maxH="56px">
            <SkeletonCircle size="50px" />
            <Skeleton h="56px" flex={1} />
          </HStack>
        ))}
      </VStack>
      <VStack mb={4}>
        <Box
          border="1px solid"
          borderColor="gray.400"
          p={1.5}
          borderRadius="8px"
          w="100%"
        >
          <InputGroup alignItems="center">
            <Textarea
              bgColor="transparent"
              minH="unset"
              border="0px"
              _focusVisible={{ boxShadow: '0px' }}
              overflow="hidden"
              resize="none"
              overflowY="scroll"
              value=""
              rows={1}
              isDisabled={true}
            />
            <IconButton
              variant="clear"
              isDisabled={true}
              type="submit"
              icon={<BiSend />}
              aria-label={'send-jarvis'}
            />
          </InputGroup>
        </Box>

        <Text textStyle="caption-2">
          Watson can make mistakes. Please use the information presented as a
          reference for guidance only.
        </Text>
      </VStack>
    </Grid>
  )
}

const ChatWindowSuspenseWrapper = ({
  conversationId,
}: {
  conversationId: number
}) => {
  const conversationStore = useAtomValue(conversationStoreAtom)

  /**
   * We dont use suspense for this because due to custom logic for optimistic loading
   * since we effectively cache some conversations in conversationStoreAtom, we can check if the conversationId has been pre-fetched
   * if it has been pre-fetched, just use the conversation history
   *
   * NOTE: We do not care about having concurrent chat windows be in sync and are fine with stale conversations chat history. Onus is on user to sync state
   *  */
  const { data: chatMsges, isFetching } =
    trpc.watson.getChatMessagesForConversation.useQuery(
      {
        conversationId,
      },
      // Only show loading window if conversationId did not exist in conversationStore
      // conversationId will not exist in conversationStore if the conversation was created from a `New Chat` and the route got redirected
      // Hence, the second check is needed so we dont get any flicker
      { enabled: !(conversationId in conversationStore) },
    )

  const prevConversationHistory = !!conversationStore[conversationId]
    ? conversationStore[conversationId]!.messages
    : []

  const initialData = !!chatMsges
    ? chatMsges.map((msg) => ({
        ...msg,
        message: msg.rawMessage,
        id: msg.id.toString(),
      }))
    : prevConversationHistory

  if (isFetching) {
    return <LoadingChatWindow />
  }

  return (
    <ChatWindow conversationId={conversationId} chatMessages={initialData} />
  )
}

export default Chat
