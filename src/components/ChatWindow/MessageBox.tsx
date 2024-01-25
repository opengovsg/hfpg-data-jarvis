import {
  HStack,
  Text,
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
} from '@chakra-ui/react'
import { IconButton, Textarea, useToast } from '@opengovsg/design-system-react'
import { useCallback, useState, type ReactNode } from 'react'
import { BiSolidBinoculars } from 'react-icons/bi'
import { BsHandThumbsDown, BsHandThumbsUp } from 'react-icons/bs'
import { useMe } from '~/features/me/api'
import { useIsTabletView } from '~/hooks/isTabletView'
import { trpc } from '~/utils/trpc'

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

export const MessageBox = ({
  message,
  type,
  id,
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
                                setBadResponseReason(e.currentTarget.value)
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
