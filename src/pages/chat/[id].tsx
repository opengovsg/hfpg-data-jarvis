import { Grid } from '@chakra-ui/react'
import _ from 'lodash'
import router from 'next/router'
import { EnforceLoginStatePageWrapper } from '~/components/AuthWrappers'
import ChatWindow from '~/components/ChatWindow/ChatWindow'
import { SideMenu } from '~/components/SideMenu/SideMenu'
import { type NextPageWithLayout } from '~/lib/types'
// import { AdminLayout } from '~/templates/layouts/AdminLayout'

const Chat: NextPageWithLayout = () => {
  const conversationId =
    router.query.id === undefined ? undefined : Number(router.query.id)

  return (
    <EnforceLoginStatePageWrapper>
      <Grid gridTemplateColumns={`260px 1fr`} h="100vh" overflowY="hidden">
        <SideMenu />
        <ChatWindow conversationId={conversationId} />
      </Grid>
    </EnforceLoginStatePageWrapper>
  )
}

export default Chat
