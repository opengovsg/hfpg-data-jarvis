import {
  IconButton,
  Box,
  VStack,
  Text,
  InputGroup,
  Textarea,
  Grid,
  FormControl,
} from '@chakra-ui/react'
import ResizeTextarea from 'react-textarea-autosize'
import _ from 'lodash'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BiSend } from 'react-icons/bi'
import { useZodForm } from '~/lib/form'
import { trpc } from '~/utils/trpc'
import { MessageBox, type MessageBoxProps } from './MessageBox'
import { useCallWatson } from './chat-window.hooks'
import { getWatsonRequestSchema } from '~/utils/watson'
import { type z } from 'zod'
import { FormErrorMessage } from '@opengovsg/design-system-react'
import { SuggestionsSection } from './SuggestionsSection'
import {
  MAX_QUESTION_LENGTH,
  MIN_QUESTION_LENGTH,
} from '~/server/modules/watson/watson.constants'
import { v4 as uuidv4 } from 'uuid'
import { type WatsonErrorRes } from '~/server/modules/watson/watson.types'

const ChatWindow = () => {
  const [conversation] = trpc.watson.getConversation.useSuspenseQuery()
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)
  const [isInputDisabled, setIsInputDisabled] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggestionLoading, setIsSuggestionLoading] = useState<boolean>(false)

  const utils = trpc.useContext()

  // TODO: List virtualisation in the future
  const [storedConversation, setStoredConversation] = useState<
    ({ id: string } & MessageBoxProps)[]
  >(
    conversation.chatMessages.map((msg) => ({
      ...msg,
      id: msg.id.toString(),
      message: msg.rawMessage,
    })),
  )

  const askQuestionForm = useZodForm({
    schema: getWatsonRequestSchema,
    defaultValues: {
      question: '',
      conversationId: conversation.conversationId,
    },
  })

  const chatWindowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!!chatWindowRef.current) {
      chatWindowRef.current.scrollTo(0, chatWindowRef.current.scrollHeight)
    }
  }, [storedConversation, suggestions])

  const shouldShowSuggestions =
    !!storedConversation[storedConversation.length - 1]?.isErrorMessage &&
    !isSuggestionLoading

  const handleOnAgentResponse = useCallback(
    (chunk: string, isError?: boolean) => {
      setIsGeneratingResponse(false)

      setStoredConversation((prev) => {
        // find last index of agent message
        const lastIndexValue = prev[prev.length - 1]

        // This should never happen
        if (lastIndexValue === undefined) {
          throw new Error(
            'Last index should always be defined when handling chunks',
          )
        }

        // This means we have yet to process first chunk from agent response
        if (lastIndexValue.type === 'USER') {
          return [
            ...prev,
            {
              type: 'AGENT',
              id: uuidv4(),
              isErrorMessage: isError,
              message: chunk,
            },
          ]
        }

        // Append to the last chunk in the chat response
        // TODO: Only render latest chat message in the dom instead of re-rendering entire patch on each chunk
        return [
          ...prev.slice(0, prev.length - 1),
          {
            ...lastIndexValue,
            message: lastIndexValue.message + chunk,
            isErrorMessage: isError,
          },
        ]
      })
    },
    [],
  )

  /** Sets message to be error message and also gives suggestions */
  const handleError = useCallback(
    async (error: WatsonErrorRes, question: string) => {
      handleOnAgentResponse(error.message, true)
      setIsSuggestionLoading(true)
      const suggestions = await utils.watson.getSuggestions.fetch({ question })
      setIsSuggestionLoading(false)

      setSuggestions(suggestions)
    },
    [handleOnAgentResponse, utils.watson.getSuggestions],
  )

  const callWatson = useCallWatson({
    handleChunk: handleOnAgentResponse,
    handleError,
  })

  const handleSubmitData = async (
    data: z.infer<typeof getWatsonRequestSchema>,
  ) => {
    if (data.question.length < MIN_QUESTION_LENGTH) {
      askQuestionForm.setError('question', {
        message: `Please enter at least ${MIN_QUESTION_LENGTH} characters`,
      })

      return
    }

    if (data.question.length > MAX_QUESTION_LENGTH) {
      askQuestionForm.setError('question', {
        message: `Please enter at most ${MAX_QUESTION_LENGTH} characters`,
      })

      return
    }

    askQuestionForm.reset({
      question: '',
      conversationId: conversation.conversationId,
    })

    setIsGeneratingResponse(true)
    setIsInputDisabled(true)

    setStoredConversation((prev) => [
      ...prev,
      {
        id: uuidv4(),
        message: data.question,
        type: 'USER',
      },
    ])

    await callWatson(data)

    setIsInputDisabled(false)
  }

  return (
    <form
      onSubmit={askQuestionForm.handleSubmit(async (data) => {
        await handleSubmitData(data)
      })}
      style={{ width: '100%', height: '100%' }}
    >
      <Grid
        gridTemplateRows={`1fr min-content`}
        h="100%"
        w="100%"
        px={8}
        bgColor="base.canvas.brand-subtle"
      >
        <VStack
          align="start"
          ref={chatWindowRef}
          spacing={6}
          w="100%"
          pt={8}
          overflowY="scroll"
        >
          {storedConversation.map((chatMsg) => (
            <MessageBox
              key={chatMsg.id}
              type={chatMsg.type}
              message={chatMsg.message}
            />
          ))}

          {isGeneratingResponse && (
            <MessageBox
              type={'LOADING-RESPONSE'}
              message={'Churning insights...'}
            />
          )}

          {shouldShowSuggestions && (
            <SuggestionsSection
              suggestions={suggestions}
              onClickSuggestion={(suggestion) =>
                askQuestionForm.setValue('question', suggestion)
              }
            />
          )}
        </VStack>

        <VStack my={4}>
          <FormControl
            isInvalid={!!askQuestionForm.formState.errors.question?.message}
          >
            <Box
              border="1px solid"
              borderColor="gray.400"
              p={1.5}
              borderRadius="8px"
              w="100%"
            >
              <InputGroup alignItems="center">
                <Textarea
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()

                      if (!isInputDisabled) {
                        await handleSubmitData(askQuestionForm.getValues())
                      }
                    }
                  }}
                  bgColor="transparent"
                  minH="unset"
                  border="0px"
                  _focusVisible={{ boxShadow: '0px' }}
                  overflow="hidden"
                  resize="none"
                  minRows={1}
                  overflowY="scroll"
                  maxRows={5}
                  as={ResizeTextarea}
                  {...askQuestionForm.register('question')}
                />
                <IconButton
                  variant="clear"
                  isDisabled={isInputDisabled}
                  type="submit"
                  icon={<BiSend />}
                  aria-label={'send-jarvis'}
                />
              </InputGroup>
            </Box>
            <FormErrorMessage>
              {askQuestionForm.formState.errors.question?.message}
            </FormErrorMessage>
          </FormControl>

          <Text textStyle="caption-2">
            Watson can make mistakes. Please use the information presented as a
            reference for guidance only.
          </Text>
        </VStack>
      </Grid>
    </form>
  )
}

export default ChatWindow
