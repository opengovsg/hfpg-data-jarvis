import { VStack, SimpleGrid, Box, Text } from '@chakra-ui/react'
import { useIsTabletView } from '~/hooks/isTabletView'

const suggestions = [
  {
    header: 'Work out the average',
    content: 'number of months flats were leased for in Bishan',
  },
  { header: 'Find the least', content: 'expensive flat sold in Punggol' },
  {
    header: 'Explain the trend',
    content: 'in price per size of 3-bedroom flats in Bedok in 2023',
  },
  { header: 'Find the most', content: 'expensive flat sold in Clementi' },
] as const

export const EmptyChatDisplay = ({
  onClickSuggestion,
}: {
  onClickSuggestion: (msg: string) => void
}) => {
  const isTabletView = useIsTabletView()

  return (
    <VStack align="start" w="full" h="full">
      <VStack align="center" justify="center" w="full" flex={1}>
        <Text textStyle={isTabletView ? 'h6' : 'h5'}>
          Hello, I&apos;m Watson ️🕵️‍♂️
        </Text>
        <Text align="center" textStyle="body-2">
          Ask me about resale flats or start with one of my suggestions.
        </Text>
      </VStack>

      <SimpleGrid columns={2} gap={2} w="full">
        {suggestions.map(({ header, content }) => (
          <Box
            borderRadius={8}
            border="1px"
            key={header}
            borderColor="interaction.main-subtle.default"
            bgColor="white"
            p={isTabletView ? 3 : 4}
            _hover={{
              bgColor: 'interaction.muted.main.hover',
              cursor: 'pointer',
            }}
            _active={{
              bgColor: 'interaction.muted.main.active',
            }}
            onClick={() => onClickSuggestion(`${header} ${content}`)}
          >
            <Text
              textStyle={isTabletView ? 'caption-1' : 'subhead-2'}
              textColor="base.content.medium"
            >
              {header}
            </Text>
            <Text
              textColor="base.content.medium"
              textStyle={isTabletView ? 'caption-2' : undefined}
            >
              {content}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </VStack>
  )
}
