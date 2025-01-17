import { Avatar, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { BiLogOut } from 'react-icons/bi'
import { useMe } from '~/features/me/api'

export const ProfileMenu = () => {
  const {
    me: { name, email },
    logout,
  } = useMe()

  const [isMenuVisible, setIsMenuVisible] = useState(false)

  const profileHeader = name ?? email ?? ''

  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutsideMenu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutsideMenu)

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideMenu)
    }
  }, [])

  return (
    <HStack
      height="min-content"
      justify="start"
      position="relative"
      w="full"
      ref={menuRef}
    >
      {isMenuVisible && (
        <VStack
          bottom={'100%'}
          position="absolute"
          w="full"
          left={0}
          borderRadius={4}
          bgColor="gray.200"
        >
          <Button
            w="full"
            leftIcon={<BiLogOut />}
            justifyContent="start"
            variant="clear"
            py={6}
            px={2}
            color="blackAlpha.700"
            _hover={{ bgColor: 'gray.300' }}
            size="xs"
            onClick={() => logout()}
          >
            Sign out
          </Button>
        </VStack>
      )}

      <HStack
        py={2}
        px={2}
        w="full"
        borderRadius={4}
        _hover={{ bgColor: 'whiteAlpha.200', cursor: 'pointer' }}
        _active={{ bgColor: 'whiteAlpha.300' }}
        onClick={() => setIsMenuVisible((prev) => !prev)}
      >
        <Avatar name={profileHeader} />
        <Text color="white" textStyle="subhead-1">
          {profileHeader}
        </Text>
      </HStack>
    </HStack>
  )
}
