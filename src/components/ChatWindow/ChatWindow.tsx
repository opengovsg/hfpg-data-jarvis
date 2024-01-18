import {
  IconButton,
  Box,
  VStack,
  Text,
  InputGroup,
  Textarea,
  Grid,
} from '@chakra-ui/react'
import ResizeTextarea from 'react-textarea-autosize'
import _ from 'lodash'
import { useEffect, useRef, useState } from 'react'
import { BiSend } from 'react-icons/bi'
import { useZodForm } from '~/lib/form'
import { askQuestionSchema } from '~/server/modules/jarvis/jarvis.schema'
// import { AdminLayout } from '~/templates/layouts/AdminLayout'
import { type RouterInput, trpc } from '~/utils/trpc'
import { MessageBox } from './MessageBox'

const ChatWindow = () => {
  const utils = trpc.useContext()

  const [conversation] = trpc.jarvis.getConversation.useSuspenseQuery()
  const getAnswerMutation = trpc.jarvis.getAnswer.useMutation()
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)

  const askQuestionForm = useZodForm({
    schema: askQuestionSchema,
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
  }, [conversation])

  const handleSubmitData = async (data: RouterInput['jarvis']['getAnswer']) => {
    askQuestionForm.reset({
      question: '',
      conversationId: conversation.conversationId,
    })

    setIsGeneratingResponse(true)

    // Optimistic update so we can see user's question immediately in the chatbox
    utils.jarvis.getConversation.setData(undefined, (oldData) => {
      if (oldData) {
        return {
          conversationId: oldData.conversationId,
          chatMessages: [
            ...oldData.chatMessages,
            {
              createdAt: new Date(),
              // -1 will never be set as an id in the database, we later invalidate this query so the optimistic id will be reset to the correct one in the database
              id: -1,
              rawMessage: data.question,
              type: 'USER',
            },
          ],
        }
      }

      return oldData
    })

    await getAnswerMutation.mutateAsync(data)

    await utils.jarvis.getConversation.invalidate()

    setIsGeneratingResponse(false)
  }

  return (
    <form
      onSubmit={askQuestionForm.handleSubmit(async (data) => {
        await handleSubmitData(data)
      })}
    >
      <Grid
        gridTemplateRows={`1fr min-content`}
        maxH="100vh"
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
          {conversation.chatMessages.map((chatMsg) => (
            <MessageBox
              key={chatMsg.id}
              type={chatMsg.type}
              message={chatMsg.rawMessage}
            />
          ))}

          {isGeneratingResponse && (
            <MessageBox type={'LOADING-RESPONSE'} message={'Me thinking'} />
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
            <InputGroup alignItems="center">
              <Textarea
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()

                    await handleSubmitData(askQuestionForm.getValues())
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
                isDisabled={isGeneratingResponse}
                type="submit"
                icon={<BiSend />}
                aria-label={'send-jarvis'}
              />
            </InputGroup>
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
