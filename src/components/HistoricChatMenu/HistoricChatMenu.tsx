import { Text, VStack } from '@chakra-ui/react'

/** TODO: Allow for chat histories here. Also create a new chat instance every time a user newly visits a page */
export const HistoricChatMenu = () => {
  return (
    <VStack
      bgColor="black"
      h="100vh"
      w="600px"
      overflowY="scroll"
      px={4}
      pt={2}
    >
      <Text
        color="white"
        fontSize="16px"
        fontWeight="semibold"
        letterSpacing="2px"
      >
        Watson
      </Text>
    </VStack>
  )
}
