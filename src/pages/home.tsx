import {
  Grid,
  Text,
  HStack,
  IconButton,
  Box,
  VStack,
  InputGroup,
  Icon,
} from '@chakra-ui/react'
import { Input, Spinner } from '@opengovsg/design-system-react'
import _ from 'lodash'
import { useEffect, useRef, useState } from 'react'
import { BiGlasses, BiSend } from 'react-icons/bi'
import { useZodForm } from '~/lib/form'
import { type NextPageWithLayout } from '~/lib/types'
import { askQuestionSchema } from '~/server/modules/jarvis/jarvis.schema'
import { AdminLayout } from '~/templates/layouts/AdminLayout'
import { trpc } from '~/utils/trpc'

const Home: NextPageWithLayout = () => {
  const utils = trpc.useContext()

  const [conversation] = trpc.jarvis.getConversation.useSuspenseQuery()
  const getAnswerMutation = trpc.jarvis.getAnswer.useMutation()
  const [isLoading, setIsLoading] = useState(false)

  const askQuestionForm = useZodForm({
    schema: askQuestionSchema,
    defaultValues: {
      question: '',
      conversationId: conversation.conversationId,
    },
  })
  const chatRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!!chatRef.current) {
      chatRef.current.scrollTo(0, chatRef.current.scrollHeight)
    }
  }, [conversation])

  return (
    <Grid h="90vh" w="100%" p={4}>
      <VStack
        bgColor="white"
        minH="80vh"
        minW="100%"
        overflowY="scroll"
        ref={chatRef}
      >
        {conversation.chatMessages.map((chatMsg) => (
          <VStack key={chatMsg.id} align="start" w="90%" p={2} pb={4}>
            <HStack spacing={1}>
              {chatMsg.type === 'AGENT' && <Icon as={BiGlasses} />}
              <Text textStyle="subhead-1">
                {chatMsg.type === 'AGENT' ? 'Jarvis' : 'You'}
              </Text>
            </HStack>
            <Box>{chatMsg.rawMessage}</Box>
          </VStack>
        ))}

        {isLoading && <Spinner />}
      </VStack>
      <form
        onSubmit={askQuestionForm.handleSubmit(async (data) => {
          askQuestionForm.reset({
            question: '',
            conversationId: conversation.conversationId,
          })

          setIsLoading(true)

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

          setIsLoading(false)
        })}
      >
        <HStack>
          <InputGroup>
            <Input
              placeholder="Message Jarvis..."
              {...askQuestionForm.register('question')}
              isDisabled={isLoading}
            />
            <IconButton
              isDisabled={isLoading}
              type="submit"
              icon={<BiSend />}
              aria-label={'send-jarvis'}
            />
          </InputGroup>
        </HStack>
      </form>
    </Grid>
  )
}

Home.getLayout = AdminLayout

export default Home
