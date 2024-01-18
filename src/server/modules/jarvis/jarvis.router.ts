import { protectedProcedure, router } from '~/server/trpc'
import { getTableInfo } from '../prompt/sql/getTablePrompt'
import { askQuestionSchema } from './jarvis.schema'

import { PreviousSqlVectorService } from './sql-vector.service'
import { getSimilarSqlStatementsPrompt } from '../prompt/sql/sql.utils'
import { generateEmbeddingFromOpenApi } from './vector.utils'
import { ChatMessageVectorService } from './chat-history.service'
import { OpenApiClient } from './open-api.service'
import {
  generateResponseFromErrors,
  assertValidAndInexpensiveQuery,
  parseOpenApiResponse,
} from './jarvis.utils'

const UNABLE_TO_FIND_ANSWER_MESSAGE = `I am unable to find the answer, please try again.`

export const jarvisRouter = router({
  getConversation: protectedProcedure.query(
    async ({ ctx: { prisma, user } }) => {
      // TODO: Change this when we support multiple conversations
      let conversation = await prisma.conversation.findFirst({
        where: { userId: user.id },
      })

      // for now just create a conversation if user does not have convo
      if (conversation === null) {
        conversation = await prisma.conversation.create({
          data: { title: '', userId: user.id },
        })
      }

      const chatMessages = await prisma.chatMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        select: {
          rawMessage: true,
          type: true,
          id: true,
          createdAt: true,
        },
      })

      return { conversationId: conversation.id, chatMessages }
    },
  ),
  getAnswer: protectedProcedure
    .input(askQuestionSchema)
    .mutation(
      async ({
        ctx: { prisma, logger },
        input: { question, conversationId },
      }) => {
        const sqlVectorService = new PreviousSqlVectorService(prisma)
        const chatHistoryVectorService = new ChatMessageVectorService(prisma)

        const questionEmbedding = await generateEmbeddingFromOpenApi(question)

        await chatHistoryVectorService.storeEmbedding({
          embedding: questionEmbedding,
          rawMessage: question,
          userType: 'USER',
          conversationId,
        })

        const nearestSqlEmbeddings =
          await sqlVectorService.findNearestEmbeddings({
            embedding: questionEmbedding,
          })

        const similarSqlStatementPrompt =
          getSimilarSqlStatementsPrompt(nearestSqlEmbeddings)

        // const chatHistoryParams = getChatHistoryParams(latest5ChatHistory)

        const tableInfo = await getTableInfo('hdb_resale_transaction', prisma)

        const preamble = `You are an AI Chatbot specialised in PostgresQL. Based on the provided SQL table schema below, write a PostgreSQL query that would answer the user's question.

      Never query for all columns from a table. You must query only the columns that are needed to answer the question.
      Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.

      ------------
      SCHEMA: ${tableInfo}
      ------------
      SIMILAR SQL STATEMENTS: ${similarSqlStatementPrompt}
      ------------

      Return only the SQL query and nothing else.
      `

        const response = await OpenApiClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: preamble,
            },
            // TODO: Chat history seems to cause model to hallucinate, to add this at a later date
            // ...chatHistoryParams,
            {
              role: 'user',
              content: question,
            },
          ],
        })

        const queryResponse = parseOpenApiResponse(
          preamble + question,
          response,
        )
        let finalResponse = UNABLE_TO_FIND_ANSWER_MESSAGE

        if (
          queryResponse.type === 'failure' ||
          queryResponse.response === UNABLE_TO_FIND_ANSWER_MESSAGE
        ) {
          return UNABLE_TO_FIND_ANSWER_MESSAGE
        }

        try {
          const query = queryResponse.response
          console.log('Generated query: ', query)

          await assertValidAndInexpensiveQuery(query, prisma)

          const res = await prisma.$queryRawUnsafe(query)

          const stringifiedRes = JSON.stringify(res, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v,
          )

          console.log('Response from SQL', stringifiedRes)

          const nlpPrompt = `Based on the table schema below, question, SQL query, and SQL response, write a natural language response:
        ------------
        SCHEMA: ${tableInfo}
        ------------
        QUESTION: ${question}
        ------------
        SQL QUERY: ${query}
        ------------
        SQL RESPONSE: ${stringifiedRes}`

          const nlpResponse = await OpenApiClient.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'system', content: nlpPrompt }],
          })

          const parsedNlpResponse = parseOpenApiResponse(nlpPrompt, nlpResponse)

          if (parsedNlpResponse.type === 'success') {
            finalResponse = parsedNlpResponse.response
          }
        } catch (e) {
          finalResponse = generateResponseFromErrors({
            error: e,
            logger,
            metadata: { queryResponse, question },
          })
        }

        const agentResEmbedding =
          await generateEmbeddingFromOpenApi(finalResponse)

        await chatHistoryVectorService.storeEmbedding({
          embedding: agentResEmbedding,
          rawMessage: finalResponse,
          userType: 'AGENT',
          conversationId,
        })

        return finalResponse
      },
    ),
})
