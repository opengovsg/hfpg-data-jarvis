import { HStack } from '@chakra-ui/react'
import _ from 'lodash'
import ChatWindow from '~/components/ChatWindow/ChatWindow'
import { HistoricChatMenu } from '~/components/HistoricChatMenu/HistoricChatMenu'
import { type NextPageWithLayout } from '~/lib/types'
// import { AdminLayout } from '~/templates/layouts/AdminLayout'

const Home: NextPageWithLayout = () => {
  return (
    <HStack h={'$100vh'} w="100vw">
      <HistoricChatMenu />
      <ChatWindow />
    </HStack>
  )
}

export default Home
