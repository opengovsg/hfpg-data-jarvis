import { getIronSession } from 'iron-session'
import { sessionOptions } from '~/server/modules/auth/session'
import { type SessionData } from '~/lib/types/session'
import { type NextApiRequest, type NextApiResponse } from 'next'
import { OpenAIClient } from '~/server/modules/watson/open-ai'
import { prisma, readonlyWatsonPrismaClient } from '~/server/prisma'
import { ChatMessageVectorService } from '~/server/modules/watson/chat-history.service'
import { PreviousSqlVectorService } from '~/server/modules/watson/sql-vector.service'
import { generateEmbeddingFromOpenAi } from '~/server/modules/watson/vector.utils'
import {
  parseOpenAiResponse,
  assertValidAndInexpensiveQuery,
  generateResponseFromErrors,
  doesPromptExceedTokenLimit,
} from '~/server/modules/watson/watson.utils'
import { getTableInfo } from '~/server/modules/prompt/sql/getTablePrompt'
import { getSimilarSqlStatementsPrompt } from '~/server/modules/prompt/sql/sql.utils'
import {
  UNABLE_TO_FIND_ANSWER_MESSAGE,
  getWatsonRequestSchema,
} from '~/utils/watson'
import {
  ClientInputError,
  TokenExceededError,
  UnableToGenerateSuitableResponse,
} from '~/server/modules/watson/watson.errors'
import {
  MIN_QUESTION_LENGTH,
  MAX_QUESTION_LENGTH,
} from '~/server/modules/watson/watson.constants'
import { type CompletedStreamingRes } from '~/server/modules/watson/watson.types'
import { createBaseLogger } from '~/lib/logger'
import { type Logger } from 'pino'

export async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(404).json({ message: 'not found' })

  const isAuthedRes = await isAuthenticated(req, res)

  if (isAuthedRes.type === 'failure') {
    return res.status(401).json({ message: 'unauthenticated' })
  }

  const logger = createBaseLogger({
    path: '/watson',
    userId: isAuthedRes.user.id,
  })

  setStreamHeaders(res)

  const requestBody = getWatsonRequestSchema.safeParse(JSON.parse(req.body))

  if (!requestBody.success) {
    return res.status(400).json(requestBody.error)
  }

  /** Step 1: Get the initial SQL query */
  let finalAgentResponse = UNABLE_TO_FIND_ANSWER_MESSAGE
  const { question, conversationId } = requestBody.data

  const loggerMetadata: Record<string, unknown> = {
    question,
  }

  const chatHistoryVectorService = new ChatMessageVectorService(prisma)
  // dummy initialisation so we can put real initialisation at try catch
  let questionEmbedding: number[] = []
  let agentSuggestions: string[] = []
  let isError = false

  try {
    questionEmbedding = await generateEmbeddingFromOpenAi(question)

    await chatHistoryVectorService.storeMessage({
      embedding: questionEmbedding,
      rawMessage: question,
      userType: 'USER',
      conversationId,
    })

    assertQuestionLengthConstraints(question)
    const tableInfo = await getTableInfo('hdb_resale_transaction', prisma)

    const sqlQuery = await generateSqlQueryFromAgent({
      question,
      questionEmbedding,
      conversationId,
      tableInfo,
    })

    loggerMetadata.sqlQuery = sqlQuery

    logger.info(loggerMetadata, 'Generated Query')

    finalAgentResponse = await runQueryAndTranslateToNlp({
      question,
      sqlQuery,
      tableInfo,
      res,
      logger,
    })
  } catch (e) {
    // If any error thrown, get an agent response
    finalAgentResponse = generateResponseFromErrors({
      error: e,
      question,
      logger,
    })

    isError = true

    // this means embedding has not been fetched by OpenAI, there is an error at that layer
    if (questionEmbedding.length !== 0) {
      // embedding initialised, we can suggest similar questions
      const service = new PreviousSqlVectorService(prisma)

      const nearestQuestions = await service.findNearestEmbeddings({
        embedding: questionEmbedding,
        limit: 4,
      })

      agentSuggestions = nearestQuestions.map((qn) => qn.rawQuestion)
    }
  }

  loggerMetadata.finalAgentResponse = finalAgentResponse

  logger.info(loggerMetadata, 'NLP response')

  const agentResEmbedding =
    await generateEmbeddingFromOpenAi(finalAgentResponse)

  await chatHistoryVectorService.storeMessage({
    embedding: agentResEmbedding,
    rawMessage: finalAgentResponse,
    userType: 'AGENT',
    conversationId,
    suggestions: agentSuggestions,
  })

  // take latest created msg as the agent response, ignore race conditions
  const { createdAt: latestChatMsgDate, id: chatMsgId } =
    await prisma.chatMessage.findFirstOrThrow({
      where: { conversation: { id: conversationId } },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        id: true,
      },
    })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      latestChatMessageAt: latestChatMsgDate,
    },
  })

  let completedStreamingRes: CompletedStreamingRes = {
    messageId: chatMsgId,
    type: 'success',
  }

  if (isError) {
    completedStreamingRes = {
      messageId: chatMsgId,
      type: 'error',
      message: finalAgentResponse,
      suggestions: agentSuggestions,
    }
  }

  res.json(completedStreamingRes)

  res.end()
}

// TODO: Check context limit of whole prompt instead of just checking question
function assertQuestionLengthConstraints(question: string) {
  if (question.length < MIN_QUESTION_LENGTH) {
    throw new ClientInputError('too_short')
  } else if (question.length > MAX_QUESTION_LENGTH) {
    throw new ClientInputError('too_long')
  }
}

/** From a question asked, we do the following steps:
 * 1. Using a question embedding, do a vectorised search in the database for closest question <> SQL query pairing in the database
 * 2. Add the top 5 Question <> SQL Query pairings to the prompt
 * 3. Add the Table information to the prompt
 * 4. TODO: Add top 5 similar historic QNAs to the prompt
 * 5. Return SQL Query
 */
async function generateSqlQueryFromAgent({
  question,
  questionEmbedding,
  conversationId,
  tableInfo,
}: {
  question: string
  conversationId: number
  questionEmbedding: number[]
  tableInfo: string
}) {
  const sqlVectorService = new PreviousSqlVectorService(prisma)
  const chatHistoryVectorService = new ChatMessageVectorService(prisma)

  const nearestSqlEmbeddings = await sqlVectorService.findNearestEmbeddings({
    embedding: questionEmbedding,
  })

  const similarSqlStatementPrompt =
    getSimilarSqlStatementsPrompt(nearestSqlEmbeddings)

  const preamble = `
  [NO PROSE]
  You are an AI Chatbot specialised in PostgresQL. Based on the provided SQL table schema below, write a PostgreSQL query that would answer the user's question.

Never query for all columns from a table. You must query only the columns that are needed to answer the question.
Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.

ALL STRING SEARCHES MUST BE CASE INSENSITIVE. FOR ANY STRINGS IN WHERE CONDITIONS, UPPER CASE THEM AUTOMATICALLY

------------
SCHEMA: ${tableInfo}
------------
SIMILAR SQL STATEMENTS: ${similarSqlStatementPrompt}
------------

Respond with only SQL code. Do not answer with any explanations -- just the code.
------------
SQL QUERY:
`

  const chatHistoryParams =
    await chatHistoryVectorService.findNearestEmbeddings({
      embedding: questionEmbedding,
      conversationId,
    })

  const response = await OpenAIClient.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: preamble,
      },
      ...chatHistoryParams,
      {
        role: 'user',
        content: question,
      },
    ],
  })

  const queryResponse = parseOpenAiResponse(preamble + question, response)

  if (
    queryResponse.type === 'failure' ||
    queryResponse.response === UNABLE_TO_FIND_ANSWER_MESSAGE
  ) {
    throw new UnableToGenerateSuitableResponse()
  }

  return queryResponse.response
}

/**
 * From the response generated in generateSqlQueryFromAgent, we try to run the sqlQuery
 *
 * NOTE: sqlQuery may not even be a valid query, so we assert `assertValidAndInexpensiveQuery` before running it
 *
 * STEPS:
 * 1. Assert if the sqlQuery from the agent is valid and inexpensive, if it is not, throw error
 * 2. Execute query
 * 3a. If query result exceeds token window, throw a TokenExceededError error
 * 3b. If query result does not exceed token window, pass it to agent and convert to NLP response
 * 4. Stream NLP response back to client with `emitAgentData`
 */
async function runQueryAndTranslateToNlp({
  question,
  sqlQuery,
  tableInfo,
  res,
  logger,
}: {
  question: string
  sqlQuery: string
  tableInfo: string
  res: NextApiResponse
  logger?: Logger<string>
}) {
  await assertValidAndInexpensiveQuery(sqlQuery, prisma)

  const sqlRes = await readonlyWatsonPrismaClient.$queryRawUnsafe(sqlQuery)

  const stringifiedRes = JSON.stringify(sqlRes, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  )

  logger?.info({ stringifiedRes }, 'Response from SQL')

  const nlpPrompt = `Based on the table schema below, question, SQL query, and SQL response, write a natural language response:
  ------------
  SCHEMA: ${tableInfo}
  ------------
  QUESTION: ${question}
  ------------
  SQL QUERY: ${sqlQuery}
  ------------
  SQL RESPONSE: ${stringifiedRes}`

  if (doesPromptExceedTokenLimit(nlpPrompt)) {
    throw new TokenExceededError()
  }

  const stream = await OpenAIClient.chat.completions.create({
    model: 'gpt-3.5-turbo',
    stream: true,
    messages: [{ role: 'user', content: nlpPrompt }],
  })

  const messageChunks: string[] = []

  for await (const data of stream) {
    const messageChunk = data.choices[0]?.delta.content ?? ''

    res.write(messageChunk)

    messageChunks.push(messageChunk)
  }

  const completeResponse = messageChunks.join('')

  return completeResponse
}

function setStreamHeaders(res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
}

type isAuthenticatedResponse = SuccessAuthentication | FailureAuthentication

type SuccessAuthentication = {
  type: 'success'
  user: { id: string }
}

type FailureAuthentication = {
  type: 'failure'
}

async function isAuthenticated(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<isAuthenticatedResponse> {
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  // We just throw TRPCErrors here to remain consistent, even though this is a rest call
  if (!session?.userId) {
    return { type: 'failure' }
  }

  // this code path is needed if a user does not exist in the database as they were deleted, but the session was active before
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true },
  })

  if (user === null) {
    return { type: 'failure' }
  }

  return { type: 'success', user: { id: user.id } }
}

export default handler
