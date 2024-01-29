import { Box, HStack, Icon, Text } from '@chakra-ui/react'
import { BiSolidBinoculars } from 'react-icons/bi'

export const WatsonIcon = () => {
  return (
    <HStack>
      <Icon as={BiSolidBinoculars} color="white" fontSize="24px" />
      <Text textStyle="h5" color="white">
        Watson
      </Text>
      <Text textStyle="h5" textColor="whiteAlpha.600">
        0.01
      </Text>
    </HStack>
  )
}

export const WatsonMenu = () => {
  return (
    <Box w="full" py={4} px={6} bgColor="base.content.strong">
      <WatsonIcon />
    </Box>
  )
}
