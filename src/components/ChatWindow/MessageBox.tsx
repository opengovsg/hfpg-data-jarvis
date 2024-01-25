import { HStack, Text, Box, Avatar, Spinner } from '@chakra-ui/react'
import { type ReactNode } from 'react'
import { BiSolidBinoculars } from 'react-icons/bi'
import { useMe } from '~/features/me/api'
import { useIsTabletView } from '~/hooks/isTabletView'

const WatsonIcon = () => {
  const isTabletView = useIsTabletView()

  return (
    <Avatar
      boxSize={isTabletView ? '40px' : '52px'}
      bg="white"
      border="1px"
      color="interaction.sub-subtle.default"
      icon={<BiSolidBinoculars color="black" size="20px" />}
    />
  )
}

export type MessageBoxProps = {
  message: string
  type: 'AGENT' | 'USER' | 'LOADING-RESPONSE'
  isErrorMessage?: boolean
  suggestions?: string[]
  id: string
}

export const MessageBoxLayout = ({
  avatar,
  message,
}: {
  avatar: ReactNode
  message: ReactNode
}) => {
  const isTabletView = useIsTabletView()

  return (
    <HStack align="end" spacing={isTabletView ? 3 : 5}>
      {avatar}
      {message}
    </HStack>
  )
}

export const MessageBox = ({ message, type }: MessageBoxProps) => {
  const {
    me: { name },
  } = useMe()

  const isTabletView = useIsTabletView()

  if (type === 'AGENT') {
    return (
      <MessageBoxLayout
        avatar={<WatsonIcon />}
        message={
          <Box
            border="1px"
            borderColor="interaction.main-subtle.default"
            bgColor="white"
            p={4}
            borderRadius="8px"
          >
            <Text
              whiteSpace="pre-line"
              fontSize={isTabletView ? '14px' : undefined}
            >
              {message}
            </Text>
          </Box>
        }
      />
    )
  }

  if (type === 'USER') {
    return (
      <MessageBoxLayout
        avatar={
          <Avatar name={name ?? ''} boxSize={isTabletView ? '40px' : '52px'} />
        }
        message={
          <Box
            border="1px"
            borderColor="interaction.main-subtle.default"
            p={4}
            borderRadius="8px"
            bgColor="interaction.main-subtle.default"
          >
            <Text
              whiteSpace="pre-line"
              fontSize={isTabletView ? '14px' : undefined}
            >
              {message}
            </Text>
          </Box>
        }
      />
    )
  }

  return (
    <MessageBoxLayout
      avatar={<WatsonIcon />}
      message={
        <HStack
          border="1px"
          borderColor="interaction.main-subtle.default"
          bgColor="white"
          p={4}
          borderRadius="8px"
        >
          <Spinner />
          <Text fontSize={isTabletView ? '14px' : undefined}>{message}</Text>
        </HStack>
      }
    />
  )
}
