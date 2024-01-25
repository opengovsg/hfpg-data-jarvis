import { HStack, Icon, Text } from '@chakra-ui/react'
import { SIDE_MENU_ITEM_PX } from './sidemenu.constants'
import { BsPencilSquare } from 'react-icons/bs'
import { useOnClickNewChat } from './side-menu.hooks'

export const SidebarHeader = () => {
  const onClickNewChat = useOnClickNewChat()

  return (
    <HStack
      // Hack to keep New Chat insync with WatsonHeader
      h="60px"
      justify="space-between"
      w="full"
      borderRadius={4}
      color="white"
      _hover={{ bgColor: 'whiteAlpha.200', cursor: 'pointer' }}
      _active={{ bgColor: 'whiteAlpha.100' }}
      px={SIDE_MENU_ITEM_PX}
      onClick={async () => {
        await onClickNewChat()
      }}
    >
      <Text textStyle="subhead-2">New Chat</Text>
      <Icon as={BsPencilSquare} />
    </HStack>
  )
}
