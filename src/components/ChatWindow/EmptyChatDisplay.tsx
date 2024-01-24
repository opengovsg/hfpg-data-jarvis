import { VStack, SimpleGrid, Box, Text } from '@chakra-ui/react'

const suggestions = [
  'What is the month over month average price trend for 3-bedroom flats in woodlands?',
  'When did the most expensive transaction in Clementi occur?',
  'What is the distance between bishan and ang mo kio?',
  'What was the average price of flats sold?',
]

export const EmptyChatDisplay = ({
  onClickSuggestion,
}: {
  onClickSuggestion: (msg: string) => void
}) => {
  return (
    <VStack align="start" w="full" h="full" justify="end">
      <Text textStyle="caption-1">Ask me your first question!</Text>
      <SimpleGrid columns={2} gap={2} w="full">
        {suggestions.map((suggestion) => (
          <Box
            borderRadius={8}
            border="1px"
            key={suggestion}
            borderColor="interaction.main-subtle.default"
            bgColor="white"
            p={4}
            _hover={{
              bgColor: 'interaction.muted.main.hover',
              cursor: 'pointer',
            }}
            _active={{
              bgColor: 'interaction.muted.main.active',
            }}
            onClick={() => onClickSuggestion(suggestion)}
          >
            <Text textStyle="caption-2" textColor="brand.secondary.400">
              {suggestion}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </VStack>
  )
}
