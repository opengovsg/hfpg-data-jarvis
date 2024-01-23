import { Box, Text, SimpleGrid, VStack } from '@chakra-ui/react'

export const SuggestionsSection = ({
  suggestions,
  onClickSuggestion,
}: {
  suggestions: string[]
  onClickSuggestion: (message: string) => void
}) => {
  return (
    <VStack align="start" w="full">
      <Text textStyle="caption-1">I can help you out with:</Text>
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
