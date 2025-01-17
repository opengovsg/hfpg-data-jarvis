import { Flex, HStack, Icon } from '@chakra-ui/react'
import {
  AvatarMenu,
  AvatarMenuDivider,
  Link,
  Menu,
} from '@opengovsg/design-system-react'
import NextLink from 'next/link'
import { BiGlasses } from 'react-icons/bi'
import { ADMIN_NAVBAR_HEIGHT } from '~/constants/layouts'
import { useMe } from '~/features/me/api'
import { CHAT, SETTINGS_PROFILE } from '~/lib/routes'

export const AppNavbar = (): JSX.Element => {
  const { me, logout } = useMe()

  return (
    <Flex flex="0 0 auto" gridColumn="1/-1" height={ADMIN_NAVBAR_HEIGHT}>
      <Flex
        pos="fixed"
        zIndex="docked"
        w="100%"
        justify="space-between"
        align="center"
        px={{ base: '1.5rem', md: '1.8rem', xl: '2rem' }}
        pl={{ base: `calc(1rem + ${ADMIN_NAVBAR_HEIGHT})`, sm: '1.5rem' }}
        py="0.375rem"
        bg="white"
        borderBottomWidth="1px"
        borderColor="base.divider.medium"
        transition="padding 0.1s"
      >
        <Link
          as={NextLink}
          href={CHAT}
          mx={{ base: 'auto', sm: 0 }}
          transition="margin 0.1s"
        >
          <Icon as={BiGlasses} fontSize={30} />
        </Link>
        <HStack
          textStyle="subhead-1"
          spacing={{ base: '0.75rem', md: '1.5rem' }}
        >
          <AvatarMenu
            src={me?.image ?? undefined}
            name={me?.name ?? undefined}
            variant="subtle"
            bg="base.canvas.brand-subtle"
            menuListProps={{ maxWidth: '19rem' }}
          >
            <Menu.Item as={NextLink} href={SETTINGS_PROFILE}>
              Edit profile
            </Menu.Item>
            <AvatarMenuDivider />
            <Menu.Item onClick={() => logout()}>Sign out</Menu.Item>
          </AvatarMenu>
        </HStack>
      </Flex>
    </Flex>
  )
}
