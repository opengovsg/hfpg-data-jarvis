import {
  Drawer,
  DrawerContent,
  DrawerOverlay,
  HStack,
  useDisclosure,
} from '@chakra-ui/react'
import { ADMIN_NAVBAR_HEIGHT } from '~/constants/layouts'
import { WatsonIcon } from '../ChatWindow/WatsonHeader'
import { IconButton } from '@opengovsg/design-system-react'
import { BiMenu, BiPlus } from 'react-icons/bi'
import { SideMenu } from './SideMenu'
import { useOnClickNewChat } from './side-menu.hooks'

export const Navbar = () => {
  const { isOpen, onClose, onOpen } = useDisclosure()
  const onClickNewChat = useOnClickNewChat()

  return (
    <>
      <HStack
        height={ADMIN_NAVBAR_HEIGHT}
        bgColor="base.content.strong"
        px={6}
        justify="space-between"
      >
        <IconButton
          onClick={onOpen}
          icon={<BiMenu />}
          size="xs"
          aria-label="navbar"
          variant="ghost"
          color="white"
        />
        <WatsonIcon />
        <IconButton
          size="xs"
          icon={<BiPlus />}
          aria-label="new-chat"
          variant="ghost"
          color="white"
          onClick={onClickNewChat}
        />
      </HStack>

      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent width="260px" maxW="260px">
          <SideMenu />
        </DrawerContent>
      </Drawer>
    </>
  )
}
