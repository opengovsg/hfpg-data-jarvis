// Streaming Functions must be defined in an
// app directory, even if the rest of your app
// is in the pages directory.
import { getIronSession } from 'iron-session'
import { sessionOptions } from '~/server/modules/auth/session'
import { type SessionData } from '~/lib/types/session'
import { type NextApiRequest, type NextApiResponse } from 'next'
import { OpenAiClient } from '~/server/modules/watson/open-ai.service'
import { prisma } from '~/server/prisma'
import { ChatMessageVectorService } from '~/server/modules/watson/chat-history.service'
import { PreviousSqlVectorService } from '~/server/modules/watson/sql-vector.service'
import { generateEmbeddingFromOpenApi } from '~/server/modules/watson/vector.utils'
import {
  parseOpenAiResponse,
  assertValidAndInexpensiveQuery,
  generateResponseFromErrors,
} from '~/server/modules/watson/watson.utils'
import { getTableInfo } from '~/server/modules/prompt/sql/getTablePrompt'
import { getSimilarSqlStatementsPrompt } from '~/server/modules/prompt/sql/sql.utils'
import {
  UNABLE_TO_FIND_ANSWER_MESSAGE,
  getWatsonRequestSchema,
} from '~/utils/watson'
import {
  ClientInputError,
  NamedEntityParsingError,
  TooManyEntitiesError,
  UnableToGenerateSuitableResponse,
} from '~/server/modules/watson/watson.errors'
import { z } from 'zod'
import { bestGuessAddressDetailsFromOneMap } from '~/server/modules/onemap/onemap.service'

// this is important to avoid the 'API resolved without sending a response for /api/test_sse, this may result in stalled requests.' warning
export const config = {
  api: {
    externalResolver: true,
  },
}

export async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(404).json({ message: 'not found' })

  const isAuthed = await isAuthenticated(req, res)

  if (!isAuthed) {
    return res.status(401).json({ message: 'unauthenticated' })
  }

  setStreamHeaders(res)

  const requestBody = getWatsonRequestSchema.safeParse(JSON.parse(req.body))

  if (!requestBody.success) {
    return res.status(400).json(requestBody.error)
  }

  /** Step 1: Get the initial SQL query */
  let finalAgentResponse = UNABLE_TO_FIND_ANSWER_MESSAGE
  const { question, conversationId } = requestBody.data
  const loggerMetadata: Record<string, unknown> = {}
  const chatHistoryVectorService = new ChatMessageVectorService(prisma)

  try {
    assertQuestionLengthConstraints(question)

    const questionEmbedding = await generateEmbeddingFromOpenApi(question)

    await chatHistoryVectorService.storeMessage({
      embedding: questionEmbedding,
      rawMessage: question,
      userType: 'USER',
      conversationId,
    })

    const tableInfo = await getTableInfo(
      [
        { tableName: 'hdb_resale_transaction' },
        {
          tableName: 'searched_address',
          additionalMetadata:
            'This table contains columns that map addresses to POST_GIS geography coordinates. Use this table for a POST_GIS "st_dwithin" radius search against "hdb_resale_transactoin" in the original query',
        },
      ],
      prisma,
    )

    const namedEntities = await detectNamedEntitiesFromQuery({ question })

    await insertAddressFromNamedEntities(namedEntities)

    const sqlQuery = await generateSqlQueryFromAgent({
      question,
      questionEmbedding,
      tableInfo,
    })

    loggerMetadata.sqlQuery = sqlQuery

    console.log('Generated query: ', sqlQuery)

    finalAgentResponse = await runQueryAndTranslateToNlp({
      question,
      sqlQuery,
      tableInfo,
      res,
    })
  } catch (e) {
    // If any error thrown, get an agent response
    finalAgentResponse = generateResponseFromErrors({
      error: e,
      metadata: loggerMetadata,
    })

    res.write(finalAgentResponse)
  }

  console.log(`NLP Response: ${finalAgentResponse}`)

  const agentResEmbedding =
    await generateEmbeddingFromOpenApi(finalAgentResponse)

  await chatHistoryVectorService.storeMessage({
    embedding: agentResEmbedding,
    rawMessage: finalAgentResponse,
    userType: 'AGENT',
    conversationId,
  })

  res.end()
}

// TODO: Check context limit of whole prompt instead of just checking question
function assertQuestionLengthConstraints(question: string) {
  if (question.length < 10) {
    throw new ClientInputError('too_short')
  } else if (question.length > 1000) {
    throw new ClientInputError('too_long')
  }
}

const namedEntityResSchema = z.array(z.string())

async function detectNamedEntitiesFromQuery({
  question,
}: {
  question: string
}) {
  const namedEntityPrompt = `You are a named entity recognition expert who's only task is to extract out the name of a location from a sentence. 

  Please perform your task on the following question below. 
  -------------------------
  QUESTION : "${question}"
  -------------------------
  Return the output as a JSON string array containing the entity names. Return the string array and nothing else.
  Examples of valid output formats: ["clementi"], ["ang mo kio", "bishan"], ["toh tuck"]`

  const res = await OpenAiClient.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: namedEntityPrompt,
      },
    ],
  })

  const content = parseOpenAiResponse(namedEntityPrompt, res)

  if (content.type === 'failure') {
    throw new Error('Failed to generate OpenAi response!')
  }

  const namedEntities = namedEntityResSchema.safeParse(
    JSON.parse(content.response),
  )

  if (!namedEntities.success) {
    throw new NamedEntityParsingError(content.response)
  }

  return namedEntities.data
}

async function insertAddressFromNamedEntities(namedEntities: string[]) {
  if (namedEntities.length === 0) {
    return null
  }

  if (namedEntities.length > 1) {
    throw new TooManyEntitiesError(namedEntities)
  }

  const locationName = namedEntities[0]!

  const addressDetails = await bestGuessAddressDetailsFromOneMap(locationName)

  const formattedAddress = addressDetails.ADDRESS.replaceAll("'", "''")

  await prisma.$queryRawUnsafe(`INSERT INTO searched_address (address, search_val, lng, lat, coords) VALUES ('${formattedAddress}', 
  '${locationName}', 
  ${addressDetails.LONGITUDE}, 
  ${addressDetails.LATITUDE}, 
  (ST_SetSRID(ST_MakePoint(${addressDetails.LONGITUDE}, ${addressDetails.LATITUDE}), 4326))) 
  ON CONFLICT DO NOTHING
  ;`)

  return addressDetails
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
  tableInfo,
}: {
  question: string
  questionEmbedding: number[]
  tableInfo: string
}) {
  const sqlVectorService = new PreviousSqlVectorService(prisma)

  const nearestSqlEmbeddings = await sqlVectorService.findNearestEmbeddings({
    embedding: questionEmbedding,
  })

  const similarSqlStatementPrompt =
    getSimilarSqlStatementsPrompt(nearestSqlEmbeddings)

  console.log('>> similar sql statements', similarSqlStatementPrompt)

  const preamble = `You are an AI Chatbot specialised in PostgresQL. Based on the provided SQL table schema below, write a PostgreSQL query that would answer the user's question.

Never query for all columns from a table. You must query only the columns that are needed to answer the question.
Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.

All searches should be case insensitive. Use ILIKE for case-insenstive search.

------------
SCHEMA: ${tableInfo}
------------
SIMILAR SQL STATEMENTS: ${similarSqlStatementPrompt}
------------

Return only the SQL query and nothing else.
`

  const response = await OpenAiClient.chat.completions.create({
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
}: {
  question: string
  sqlQuery: string
  tableInfo: string
  res: NextApiResponse
}) {
  // await assertValidAndInexpensiveQuery(sqlQuery, prisma)

  const sqlRes = await prisma.$queryRawUnsafe(sqlQuery)

  const stringifiedRes = JSON.stringify(sqlRes, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  )

  console.log('Response from SQL', stringifiedRes)

  const nlpPrompt = `Based on the table schema below, question, SQL query, and SQL response, write a natural language response:
  ------------
  SCHEMA: ${tableInfo}
  ------------
  QUESTION: ${question}
  ------------
  SQL QUERY: ${sqlQuery}
  ------------
  SQL RESPONSE: ${stringifiedRes}`

  const stream = await OpenAiClient.chat.completions.create({
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

async function isAuthenticated(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  // We just throw TRPCErrors here to remain consistent, even though this is a rest call
  if (!session?.userId) {
    return false
  }

  // this code path is needed if a user does not exist in the database as they were deleted, but the session was active before
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true },
  })

  if (user === null) {
    return false
  }

  return true
}

export default handler
