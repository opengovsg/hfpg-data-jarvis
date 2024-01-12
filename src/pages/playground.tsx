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
import { uniqueId } from 'lodash'
import { useState } from 'react'
import { BiGlasses, BiSend } from 'react-icons/bi'
import { useZodForm } from '~/lib/form'
import { type NextPageWithLayout } from '~/lib/types'
import { askQuestionSchema } from '~/server/modules/jarvis/jarvis.schema'
import { AdminLayout } from '~/templates/layouts/AdminLayout'
import { trpc } from '~/utils/trpc'

type ChatMessageType = {
  from: 'you' | 'jarvis'
  message: string
  id: string
}

const Playground: NextPageWithLayout = () => {
  const utils = trpc.useContext()

  const [chatHistory, setChatHistory] = useState<Array<ChatMessageType>>([])
  const [isLoading, setIsLoading] = useState(false)

  const askQuestionForm = useZodForm({
    schema: askQuestionSchema,
    defaultValues: { question: '' },
  })

  return (
    <Grid h="90vh" w="100%" p={4}>
      <VStack bgColor="white" minH="80vh" minW="100%">
        {chatHistory.map((chatMsg) => (
          <VStack key={chatMsg.id} align="start" w="90%" p={2}>
            <HStack spacing={1}>
              {chatMsg.from === 'jarvis' && <Icon as={BiGlasses} />}
              <Text textStyle="subhead-1">{_.capitalize(chatMsg.from)}</Text>
            </HStack>
            <Box>{chatMsg.message}</Box>
          </VStack>
        ))}

        {isLoading && <Spinner />}
      </VStack>
      <form
        onSubmit={askQuestionForm.handleSubmit(async (data) => {
          setIsLoading(true)
          chatHistory.push({
            message: data.question,
            id: uniqueId(),
            from: 'you',
          })
          const res = await utils.jarvis.get.fetch(data)

          setChatHistory((hist) => [
            ...hist,
            { message: res, id: uniqueId(), from: 'jarvis' },
          ])
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

Playground.getLayout = AdminLayout

export default Playground
