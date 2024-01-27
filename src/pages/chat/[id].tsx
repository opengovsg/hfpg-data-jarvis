import {
  Grid,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react'
import { useAtom, useAtomValue } from 'jotai'
import _ from 'lodash'
import router from 'next/router'
import { EnforceLoginStatePageWrapper } from '~/components/AuthWrappers'
import ChatWindow from '~/components/ChatWindow/ChatWindow'
import {
  FAKE_CHAT_ID,
  conversationStoreAtom,
  tableInfoAtom,
} from '~/components/ChatWindow/chat-window.atoms'
import { SideMenu } from '~/components/SideMenu/SideMenu'
import { type NextPageWithLayout } from '~/lib/types'
import { trpc } from '~/utils/trpc'
import { ChatWindowSkeleton } from '../../components/ChatWindow/ChatWindowSkeleton'
import { Navbar } from '~/components/SideMenu/Navbar'
import { useIsTabletView } from '~/hooks/isTabletView'
import { TableInfoLayout } from '~/components/ChatWindow/TableDataViewer'

const Chat: NextPageWithLayout = () => {
  const conversationId =
    router.query.id === undefined ? FAKE_CHAT_ID : Number(router.query.id)

  const isTabletView = useIsTabletView()

  return (
    <EnforceLoginStatePageWrapper>
      <Grid
        gridTemplateColumns={isTabletView ? undefined : `260px 1fr`}
        gridTemplateRows={isTabletView ? 'min-content 1fr' : undefined}
        h="$100vh"
        overflowY="hidden"
      >
        {isTabletView ? <Navbar /> : <SideMenu />}

        <ChatWindowSuspenseWrapper
          conversationId={conversationId}
          key={conversationId}
        />
      </Grid>
    </EnforceLoginStatePageWrapper>
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
        generatedQuery: msg.sqlQuery === null ? undefined : msg.sqlQuery,
        question: msg.question === null ? undefined : msg.question,
        // all prev chat msges are completed
        isCompleted: true,
        isGoodResponse:
          msg.isGoodResponse === null ? undefined : msg.isGoodResponse,
        badResponseReason:
          msg.badResponseReason === null ? undefined : msg.badResponseReason,
        message: msg.rawMessage,
        id: msg.id.toString(),
      }))
    : prevConversationHistory

  if (isFetching) {
    return <ChatWindowSkeleton />
  }

  return (
    <>
      <ChatWindow conversationId={conversationId} chatMessages={initialData} />
      <TableModal />
    </>
  )
}

const TableModal = () => {
  const [tableData, setTableData] = useAtom(tableInfoAtom)
  const isTabletView = useIsTabletView()

  if (tableData === null) return <></>

  return (
    <Modal
      isOpen={!!tableData}
      onClose={() => setTableData(null)}
      size={isTabletView ? 'full' : '6xl'}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Data Preview</ModalHeader>

        <ModalCloseButton />
        <ModalBody>
          <TableInfoLayout {...tableData} />
        </ModalBody>

        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default Chat
