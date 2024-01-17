import { protectedProcedure, router } from '~/server/trpc'
import { getTableInfo } from '../prompt/sql/getTablePrompt'
import { askQuestionSchema } from './jarvis.schema'

import { PreviousSqlVectorService } from './sql-vector.service'
import { getSimilarSqlStatementsPrompt } from '../prompt/sql/sql.utils'
import { generateEmbeddingFromOpenApi } from './vector.utils'
import { ChatHistoryVectorService } from './chat-history.service'
import { OpenApiClient } from './open-api.service'
import { normaliseErrors, parseOpenApiResponse } from './jarvis.utils'

const UNABLE_TO_FIND_ANSWER_MESSAGE = `I am unable to find the answer, please try again.`

export const jarvisRouter = router({
  get: protectedProcedure.input(askQuestionSchema).query(
    async ({
      ctx: {
        prisma,
        logger,
        user: { id: userId },
      },
      input: { question },
    }) => {
      const sqlVectorService = new PreviousSqlVectorService(prisma)
      const chatHistoryVectorService = new ChatHistoryVectorService(prisma)

      const questionEmbedding = await generateEmbeddingFromOpenApi(question)

      const nearestSqlEmbeddings = await sqlVectorService.findNearestEmbeddings(
        {
          embedding: questionEmbedding,
        },
      )

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

      If you do not have the answer, please respond with: ${UNABLE_TO_FIND_ANSWER_MESSAGE}

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

      const queryResponse = parseOpenApiResponse(response)
      let finalResponse = UNABLE_TO_FIND_ANSWER_MESSAGE

      if (
        queryResponse.type === 'failure' ||
        queryResponse.response === UNABLE_TO_FIND_ANSWER_MESSAGE
      ) {
        return UNABLE_TO_FIND_ANSWER_MESSAGE
      }

      try {
        console.log('Generated query: ', queryResponse.response)
        const res = await prisma.$queryRawUnsafe(queryResponse.response)

        const nlpPrompt = `Based on the table schema below, question, SQL query, and SQL response, write a natural language response:
        ------------
        SCHEMA: ${tableInfo}
        ------------
        QUESTION: ${question}
        ------------
        SQL QUERY: ${queryResponse.response}
        ------------
        SQL RESPONSE: ${JSON.stringify(res, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v,
        )}`

        const nlpResponse = await OpenApiClient.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: nlpPrompt }],
        })

        const parsedNlpResponse = parseOpenApiResponse(nlpResponse)

        if (parsedNlpResponse.type === 'success') {
          finalResponse = parsedNlpResponse.response
        }
      } catch (e) {
        normaliseErrors({
          error: e,
          logger,
          metadata: { queryResponse, question },
        })
      }

      const agentResEmbedding =
        await generateEmbeddingFromOpenApi(finalResponse)

      await Promise.all([
        chatHistoryVectorService.storeEmbedding({
          embedding: agentResEmbedding,
          rawMessage: finalResponse,
          userType: 'AGENT',
          userId,
        }),
        chatHistoryVectorService.storeEmbedding({
          embedding: questionEmbedding,
          rawMessage: question,
          userType: 'USER',
          userId,
        }),
      ])

      return finalResponse
    },
  ),
})
