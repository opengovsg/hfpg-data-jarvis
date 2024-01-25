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
import { useEffect, useRef } from 'react'
import { BiSend } from 'react-icons/bi'
import { useZodForm } from '~/lib/form'
import { MessageBox, type MessageBoxProps } from './MessageBox'
import {
  useCallWatson,
  useSyncConversationStoreWithChatWindowState,
} from './chat-window.hooks'
import { getWatsonRequestSchema } from '~/utils/watson'
import { type z } from 'zod'
import { FormErrorMessage } from '@opengovsg/design-system-react'
import { SuggestionsSection } from './SuggestionsSection'
import {
  MAX_QUESTION_LENGTH,
  MIN_QUESTION_LENGTH,
} from '~/server/modules/watson/watson.constants'
import { EmptyChatDisplay } from './EmptyChatDisplay'
import { useSetAtom } from 'jotai'
import {
  updateChatMessagesAtom,
  updateConversationInputDisabledAtom,
  updateConversationIsGeneratingResponseAtom,
  useGetCurrentConversation,
} from './chat-window.atoms'
import { WatsonHeader } from './WatsonHeader'

const ChatWindow = ({
  conversationId,
  chatMessages: fetchedChatMessages,
}: {
  chatMessages: MessageBoxProps[]
  conversationId: number
}) => {
  const setIsGeneratingResponse = useSetAtom(
    updateConversationIsGeneratingResponseAtom,
  )
  const setIsInputDisabled = useSetAtom(updateConversationInputDisabledAtom)

  const conversation = useGetCurrentConversation(conversationId)

  const isInputDisabled = conversation.isInputDisabled

  useSyncConversationStoreWithChatWindowState({
    conversationId,
    chatMessages: fetchedChatMessages,
  })

  const askQuestionForm = useZodForm({
    schema: getWatsonRequestSchema,
    defaultValues: {
      question: '',
      conversationId: conversationId,
    },
  })

  const chatMessages = conversation.messages
  const updateChatMessage = useSetAtom(updateChatMessagesAtom)

  const isGeneratingResponse = !!conversation.isGeneratingResponse

  const chatWindowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!!chatWindowRef.current) {
      chatWindowRef.current.scrollTo(0, chatWindowRef.current.scrollHeight)
    }
  }, [conversation])

  const lastChatMessage =
    conversation.messages[conversation.messages.length - 1]

  const shouldShowSuggestions = !!lastChatMessage?.suggestions

  const { sendQuestion } = useCallWatson()

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
      conversationId: conversationId,
    })

    setIsGeneratingResponse({ conversationId, isGeneratingResponse: true })
    setIsInputDisabled({ conversationId, isDisabled: true })

    updateChatMessage({
      isUserUpdate: true,
      chunk: data.question,
      conversationId,
    })

    await sendQuestion(data)
  }

  // Hack to keep global state and controlled form state in sync, TODO: remove form state completely
  useEffect(() => {
    if (conversationId) {
      askQuestionForm.setValue('conversationId', conversationId)
    }
  }, [askQuestionForm, conversationId])

  return (
    <form
      onSubmit={askQuestionForm.handleSubmit(async (data) => {
        await handleSubmitData(data)
      })}
      style={{ width: '100%', height: '100%', overflowY: 'hidden' }}
    >
      <Grid
        gridTemplateRows={`min-content 1fr min-content`}
        h="100%"
        w="100%"
        bgColor="base.canvas.brand-subtle"
      >
        <WatsonHeader />

        <VStack
          align="start"
          px={8}
          ref={chatWindowRef}
          spacing={6}
          w="100%"
          pt={8}
          pb={4}
          overflowY="scroll"
        >
          {fetchedChatMessages.length === 0 && (
            <EmptyChatDisplay
              onClickSuggestion={(suggestion) =>
                askQuestionForm.setValue('question', suggestion)
              }
            />
          )}

          {chatMessages.map((chatMsg) => (
            <MessageBox
              id={chatMsg.id}
              key={chatMsg.id}
              type={chatMsg.type}
              message={chatMsg.message}
            />
          ))}

          {isGeneratingResponse && (
            <MessageBox
              id={'LOADING_RESPONSE'}
              type={'LOADING-RESPONSE'}
              message={'Churning insights...'}
            />
          )}

          {shouldShowSuggestions && (
            <SuggestionsSection
              suggestions={lastChatMessage.suggestions ?? []}
              onClickSuggestion={(suggestion) =>
                askQuestionForm.setValue('question', suggestion)
              }
            />
          )}
        </VStack>

        <VStack mb={4} px={8}>
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
