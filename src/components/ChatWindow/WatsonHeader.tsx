import { HStack, Icon, Text } from '@chakra-ui/react'
import { BiSolidBinoculars } from 'react-icons/bi'

export const WatsonHeader = () => {
  return (
    <HStack w="full" py={4} px={6} align="center" bgColor="base.content.strong">
      <Icon as={BiSolidBinoculars} color="white" fontSize="24px" />
      <Text textStyle="h5" color="white">
        WatsonAI
      </Text>
      <Text textStyle="h5" textColor="whiteAlpha.600">
        0.01
      </Text>
    </HStack>
  )
}
