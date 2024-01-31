import {
  VStack,
  SimpleGrid,
  Box,
  Text,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
  Table,
  Thead,
  Tr,
  Th,
  Td,
  Tbody,
  TableContainer,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import NextLink from 'next/link'
import { useMemo } from 'react'
import { BiLinkExternal, BiTable } from 'react-icons/bi'
import { useIsTabletView } from '~/hooks/isTabletView'
import { trpc } from '~/utils/trpc'

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
  {
    header: 'What is the year over year average price trend',
    content: 'for 3-bedroom flats in Woodlands?',
  },
] as const

export const EmptyChatDisplay = ({
  onClickSuggestion,
}: {
  onClickSuggestion: (msg: string) => void
}) => {
  const isTabletView = useIsTabletView()

  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <VStack align="start" w="full" h="full">
      <VStack align="center" justify="center" w="full" flex={1}>
        <Text textStyle={isTabletView ? 'h6' : 'h5'}>
          Hello, I&apos;m Watson ️🕵️‍♂️
        </Text>
        <Text align="center" textStyle="body-2">
          Ask me about resale flats or start with one of my suggestions.
        </Text>

        <Button
          variant="link"
          size="xs"
          leftIcon={<BiTable />}
          alignContent="center"
          onClick={onOpen}
        >
          See example data
        </Button>
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

      <TableInfoModal onClose={onClose} isOpen={isOpen} />
    </VStack>
  )
}

const TableInfoModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) => {
  const [tableInfo] = trpc.watson.getTableInfo.useSuspenseQuery()

  const colNames = useMemo(() => {
    const firstRow = tableInfo.sampleData[0]!

    return Object.keys(firstRow)
  }, [tableInfo.sampleData])

  const isTabletView = useIsTabletView()

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalHeader>About this data</ModalHeader>
        <ModalBody>
          <VStack align="start" spacing={8}>
            <VStack align="start">
              <Text>
                Our dataset contains information about all HDB resale
                transactions made between 1990 and 2017.
              </Text>

              <Text>
                Please refer to the data below to see what you can ask Watson
                about.
              </Text>

              <Button
                as={NextLink}
                size="xs"
                variant="link"
                leftIcon={<BiLinkExternal />}
                target="blank"
                title="Explore full dataset"
                href="https://beta.data.gov.sg/collections/189/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/view"
              >
                Explore full dataset
              </Button>
            </VStack>

            <VStack align="start" w="full">
              <Text textStyle={isTabletView ? 'h6' : 'h5'}>Sample data</Text>

              <TableContainer overflowX="scroll" w="full">
                <Table size={'sm'} variant="striped">
                  <Thead>
                    <Tr>
                      {colNames.map((colName) => (
                        <Th key={colName} textTransform="lowercase">
                          {colName.replace(/([a-z])([A-Z])/g, '$1_$2')}
                        </Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {tableInfo.sampleData.map((row) => (
                      <Tr key={row.identifier}>
                        {Object.entries(row).map(([key, value]) => (
                          <Td key={`${row.identifier} ${value} ${key}`}>
                            {String(value)}
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </VStack>

            <VStack align="start" w="full">
              <Text textStyle={isTabletView ? 'h6' : 'h5'}>
                Column Metadata
              </Text>

              <TableContainer w="full" overflowX="scroll">
                <Table variant="striped" size={'sm'}>
                  <Thead>
                    <Tr>
                      <Th>Column name</Th>
                      <Th>Data Type</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {tableInfo.colMetadata.map((row) => (
                      <Tr key={row.column_name}>
                        <Td>{row.column_name}</Td>
                        <Td>{row.data_type}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </VStack>
          </VStack>
        </ModalBody>
        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  )
}
