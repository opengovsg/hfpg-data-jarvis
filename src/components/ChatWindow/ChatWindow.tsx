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
import { useEffect, useRef, useState } from 'react'
import { BiSend } from 'react-icons/bi'
import { useZodForm } from '~/lib/form'
import { trpc } from '~/utils/trpc'
import { MessageBox, type MessageBoxProps } from './MessageBox'
import { useCallWatson } from './chat-window.hooks'
import { getWatsonRequestSchema } from '~/utils/watson'
import { type z } from 'zod'
import { FormErrorMessage } from '@opengovsg/design-system-react'

const ChatWindow = () => {
  const [conversation] = trpc.jarvis.getConversation.useSuspenseQuery()
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)
  const [isInputDisabled, setIsInputDisabled] = useState(false)

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
  }, [storedConversation])

  const callWatson = useCallWatson({
    handleChunk: (chunk) => {
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
              id: _.uniqueId(),
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
          },
        ]
      })
    },
  })

  const handleSubmitData = async (
    data: z.infer<typeof getWatsonRequestSchema>,
  ) => {
    askQuestionForm.reset({
      question: '',
      conversationId: conversation.conversationId,
    })

    setIsGeneratingResponse(true)
    setIsInputDisabled(true)

    setStoredConversation((prev) => [
      ...prev,
      {
        id: _.uniqueId(),
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
        </VStack>

        <VStack my={4}>
          <Box
            border="1px solid"
            borderColor="gray.400"
            p={1.5}
            borderRadius="8px"
            w="100%"
          >
            <FormControl
              isInvalid={!!askQuestionForm.formState.errors.question?.message}
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
              <FormErrorMessage>
                {askQuestionForm.formState.errors.question?.message}
              </FormErrorMessage>
            </FormControl>
          </Box>

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
