import { HStack, Text, Box, Avatar, Spinner } from '@chakra-ui/react'
import { BiSolidBinoculars } from 'react-icons/bi'
import { useMe } from '~/features/me/api'

const WatsonIcon = () => {
  return (
    <Avatar
      boxSize="52px"
      bg="white"
      border="1px"
      color="interaction.sub-subtle.default"
      icon={<BiSolidBinoculars color="black" size="20px" />}
    />
  )
}

export const MessageBox = ({
  message,
  type,
}: {
  message: string
  type: 'AGENT' | 'USER' | 'LOADING-RESPONSE'
}) => {
  const {
    me: { name },
  } = useMe()

  if (type === 'AGENT') {
    return (
      <HStack align="end" spacing={5}>
        <WatsonIcon />
        <Box
          border="1px"
          borderColor="interaction.main-subtle.default"
          bgColor="white"
          p={4}
          borderRadius="8px"
        >
          <Text whiteSpace="pre-line">{message}</Text>
        </Box>
      </HStack>
    )
  }

  if (type === 'USER') {
    return (
      <HStack align="end" spacing={5}>
        <Avatar name={name ?? ''} boxSize="52px" />
        <Box
          border="1px"
          borderColor="interaction.main-subtle.default"
          p={4}
          borderRadius="8px"
          bgColor="interaction.main-subtle.default"
        >
          <Text whiteSpace="pre-line">{message}</Text>
        </Box>
      </HStack>
    )
  }

  return (
    <HStack align="end" spacing={5}>
      <WatsonIcon />
      <HStack border="1px" borderColor="gray.200" p={4} borderRadius="8px">
        <Spinner />
        <Text>{message}</Text>
      </HStack>
    </HStack>
  )
}
