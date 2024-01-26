import {
  HStack,
  Text,
  Code,
  Box,
  Avatar,
  Spinner,
  VStack,
  Tooltip,
  Button,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Table,
  Tr,
  Td,
  Thead,
  Th,
  TableContainer,
  Flex,
  ButtonGroup,
} from '@chakra-ui/react'
import { format } from 'sql-formatter'
import { IconButton, Textarea, useToast } from '@opengovsg/design-system-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  BiChevronLeft,
  BiChevronRight,
  BiSolidBinoculars,
  BiTerminal,
} from 'react-icons/bi'
import { BsHandThumbsDown, BsHandThumbsUp, BsTable } from 'react-icons/bs'
import { v4 } from 'uuid'
import { useMe } from '~/features/me/api'
import { useIsTabletView } from '~/hooks/isTabletView'
import { trpc } from '~/utils/trpc'
import { useSetAtom } from 'jotai'
import { tableDataAtom } from './chat-window.atoms'

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
  isCompleted?: boolean
  isGoodResponse?: boolean
  badResponseReason?: string
  suggestions?: string[]
  generatedQuery?: string
  id: string
}

export const MessageBoxLayout = ({
  avatar,
  message,
  previewData,
}: {
  avatar: ReactNode
  message: ReactNode
  previewData?: ReactNode
}) => {
  const isTabletView = useIsTabletView()

  return (
    <VStack w="full" align="start">
      <HStack align="end" spacing={isTabletView ? 3 : 5} w="full">
        {avatar}
        {message}
      </HStack>

      <Flex w="full" justify="center">
        {previewData}
      </Flex>
    </VStack>
  )
}

export const MessageBox = ({
  message,
  type,
  id,
  generatedQuery,
  isGoodResponse,
  isCompleted,
  badResponseReason,
}: MessageBoxProps) => {
  const {
    me: { name },
  } = useMe()

  // TODO: deal with stale state on any update failures here
  const [localBadResponseReason, setBadResponseReason] = useState(
    badResponseReason ?? '',
  )
  // do this so we can optimstically update
  const [localIsUseful, setLocalIsUseful] = useState(isGoodResponse)

  const isTabletView = useIsTabletView()

  const toast = useToast({ isClosable: true })

  const rateResponseMutation = trpc.watson.rateResponse.useMutation()

  const utils = trpc.useContext()

  const setTableData = useSetAtom(tableDataAtom)

  const handleOnClickThumbsUp = useCallback(async () => {
    try {
      await rateResponseMutation.mutateAsync({
        isGoodResponse: true,
        messageId: Number(id),
      })
      setLocalIsUseful(true)
    } catch (e) {
      toast({
        status: 'error',
        description:
          'Something went wrong rating response. Please try again or contact us for help',
      })
    }
  }, [id, rateResponseMutation, toast])

  const handleOnClickThumbsDown = useCallback(
    async (reason: string) => {
      try {
        await rateResponseMutation.mutateAsync({
          isGoodResponse: false,
          messageId: Number(id),
          badResponseReason: reason,
        })
        setLocalIsUseful(false)
      } catch (e) {
        toast({
          status: 'error',
          description:
            'Something went wrong rating response. Please try again or contact us for help',
        })
      }
    },
    [id, rateResponseMutation, toast],
  )

  if (type === 'AGENT') {
    return (
      <MessageBoxLayout
        avatar={
          <VStack spacing={1}>
            <WatsonIcon />
            {/* Hack to center align avatar with message box due to good/bad
            response icons */}
            {isCompleted && <Box h="20px" />}
          </VStack>
        }
        message={
          <VStack spacing={1} align="end">
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

            {isCompleted && (
              <HStack spacing={2} h="20px">
                {!!generatedQuery && (
                  <Tooltip label="View Data">
                    <IconButton
                      aria-label="useful"
                      onClick={async () => {
                        const res = await utils.watson.getTable.fetch({
                          messageId: Number(id),
                          limit: 10,
                          offset: 0,
                        })

                        setTableData({
                          data: res.data,
                          hasNext: res.hasNext,
                          messageId: id,
                          generatedQuery,
                          limit: 10,
                          offset: 0,
                        })
                      }}
                      icon={<BsTable size="14px" />}
                      variant="link"
                      minH={'14px'}
                      p={1}
                      color={localIsUseful ? 'gray.500' : 'gray.400'}
                      minW="fit-content"
                    />
                  </Tooltip>
                )}
                <Tooltip label="Good response">
                  <IconButton
                    aria-label="useful"
                    backgroundColor={localIsUseful ? 'gray.200' : undefined}
                    onClick={() => handleOnClickThumbsUp()}
                    icon={<BsHandThumbsUp size="14px" />}
                    variant="link"
                    minH={'14px'}
                    p={1}
                    color={localIsUseful ? 'gray.500' : 'gray.400'}
                    minW="fit-content"
                  />
                </Tooltip>

                <Popover>
                  {({ onClose }) => (
                    <>
                      <Tooltip label="Bad response">
                        <Box display="inline-block">
                          <PopoverTrigger>
                            <IconButton
                              aria-label="not-useful"
                              backgroundColor={
                                localIsUseful === false ? 'gray.200' : undefined
                              }
                              icon={<BsHandThumbsDown size="14px" />}
                              variant="link"
                              p={1}
                              minH={'14px'}
                              color={localIsUseful ? 'gray.500' : 'gray.400'}
                              minW="fit-content"
                            />
                          </PopoverTrigger>
                        </Box>
                      </Tooltip>

                      <PopoverContent>
                        <PopoverHeader>
                          <Text textStyle="subhead-2">Bad Response Reason</Text>
                        </PopoverHeader>
                        <PopoverBody>
                          <VStack align="start">
                            <Textarea
                              size="xs"
                              value={localBadResponseReason}
                              onChange={(e) => {
                                {
                                  /* // TODO: Make this a controlled component with error handling for max string len */
                                }
                                if (e.currentTarget.value.length <= 300) {
                                  setBadResponseReason(e.currentTarget.value)
                                }
                              }}
                            />
                            <Button
                              size="xs"
                              colorScheme="slate"
                              onClick={async () => {
                                await handleOnClickThumbsDown(
                                  localBadResponseReason,
                                )
                                onClose()
                              }}
                            >
                              Submit
                            </Button>
                          </VStack>
                        </PopoverBody>
                      </PopoverContent>
                    </>
                  )}
                </Popover>
              </HStack>
            )}
          </VStack>
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

export const TableDataViewer = ({
  data,
  limit,
  offset,
  hasNext,
  messageId,
  generatedQuery,
}: {
  data: Record<string, unknown>[]
  generatedQuery: string
  limit: number
  hasNext: boolean
  messageId: string
  offset: number
}) => {
  const columnNames = useMemo(() => {
    return Object.keys(data[0]!)
  }, [data])

  const dataWithId = useMemo(
    () => data.map((row) => ({ rowData: row, uniqueId: v4() })),
    [data],
  )
  const setTableData = useSetAtom(tableDataAtom)

  const utils = trpc.useContext()

  const handleClickChevron = useCallback(
    async ({ offset }: { offset: number }) => {
      const res = await utils.watson.getTable.fetch({
        messageId: Number(messageId),
        limit: limit,
        offset: offset,
      })

      setTableData({
        data: res.data,
        generatedQuery,
        messageId,
        limit: limit,
        offset: offset,
        hasNext: res.hasNext,
      })
    },
    [generatedQuery, limit, messageId, setTableData, utils.watson.getTable],
  )

  const [isSqlViewable, setIsSqlViewable] = useState(false)
  if (data.length === 0) {
    return <Text>no data to preview</Text>
  }

  return (
    <VStack w="full" align="start" spacing={2}>
      <VStack w="full" align="center">
        <TableContainer w="full">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                {columnNames.map((col) => (
                  <Th key={col} textTransform="capitalize">
                    {col.replaceAll('_', ' ')}
                  </Th>
                ))}
              </Tr>
            </Thead>
            {dataWithId.map((r) => (
              <Tr key={r.uniqueId}>
                {columnNames.map((col) => (
                  <Td key={`${r.uniqueId} ${col}`}>{String(r.rowData[col])}</Td>
                ))}
              </Tr>
            ))}
          </Table>
        </TableContainer>

        <HStack w="full" justify="space-between">
          <ButtonGroup>
            <IconButton
              aria-label="left"
              icon={<BiChevronLeft />}
              size="xs"
              variant="clear"
              isDisabled={offset === 0}
              onClick={async () =>
                await handleClickChevron({ offset: offset - 1 })
              }
            />
            <IconButton
              aria-label="right"
              onClick={async () =>
                await handleClickChevron({ offset: offset + 1 })
              }
              icon={<BiChevronRight />}
              size="xs"
              variant="clear"
              isDisabled={!hasNext}
            />
          </ButtonGroup>

          <Button
            p={0}
            variant="clear"
            onClick={() => setIsSqlViewable((prev) => !prev)}
            size="xs"
            leftIcon={<BiTerminal />}
          >
            <code>{isSqlViewable ? `Hide` : `View`} Code</code>
          </Button>
        </HStack>
      </VStack>

      {isSqlViewable && (
        <pre style={{ width: '100%' }}>
          <Code
            bgColor="base.content.strong"
            color="gray.100"
            p={4}
            width="100%"
            borderRadius={4}
          >
            {format(generatedQuery, {
              tabWidth: 4,
              language: 'postgresql',
            })}
          </Code>
        </pre>
      )}
    </VStack>
  )
}
