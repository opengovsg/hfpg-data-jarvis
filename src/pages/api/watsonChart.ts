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
import * as fs from 'fs';

export async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(404).json({ message: 'not found' })

  const requestBody = getWatsonRequestSchema.safeParse(JSON.parse(req.body))

  if (!requestBody.success) {
    return res.status(400).json(requestBody.error)
  }
  
  // run the thread
  
  const { question, conversationId } = requestBody.data
  
    // POST /api/watson/getchart
    // params that will be sent from frontend -
      // const requestParams = {
      //   threadId: 'thread_SWOr2JQnP364AZDCPO7E1JPC',
      //   assistantId: 'asst_9dWpeAjuq58LhAoILrRPGoei',
      //   question: 'What is the average price of 4 room flats in bishan in 2023 for each months? Return it as a chart'
      // }
    // response you want - 
    // const response = {
    //   response: '' - either be a binary string, or static url
    // }
    
  
    // 1. create message based on thread id
    const threadId = 'thread_4UsV21OZK2uMa7cHAYqKfI7L'
    const threadMessages = await OpenAIClient.beta.threads.messages.create(
      threadId,
      { role: "user", content: "What is the average price of 4 room flats in bishan in 2023 for each months? Return it as a chart" }
    );
    console.log(threadMessages, 'thread messages')

    // 2. create run
    const assistantId = 'asst_9dWpeAjuq58LhAoILrRPGoei'
    const createRun = await OpenAIClient.beta.threads.runs.create(
      threadId,
      { assistant_id: assistantId}
    );
    console.log(createRun, 'createRun');

    // 3. retrieve run
    async function pollRetrieveRunUntilCompleted(threadId: string, runId: string) {
      let retrieveRun: {status: string, file_ids:string[]};
    
      // Define a function to retrieve the run
      const retrieveRunFunction = async () => {
        retrieveRun = await OpenAIClient.beta.threads.runs.retrieve(threadId, runId);
        console.log(retrieveRun, 'retrieveRun');
        return retrieveRun
      };
      retrieveRun = await retrieveRunFunction()
      // Poll until retrieveRun.status is 'completed'
      while (!retrieveRun || retrieveRun.status !== 'completed') {
        await retrieveRunFunction(); // Call the function
    
        // Wait for 1 second before the next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    
      console.log('Run completed:', retrieveRun);
      return
    }
    
    // 4. Call the function with the appropriate threadId and runId
    await pollRetrieveRunUntilCompleted(threadId, createRun.id);

    // 5. List Messages
    const threadMessagesAfterRun = await OpenAIClient.beta.threads.messages.list(
      threadId, {order: 'desc'}
    );
  
    console.log(threadMessagesAfterRun, 'threadMessagesAfterRun');
    // 6. Get latest message file id
    const latestMessageContent = threadMessagesAfterRun.data[0]?.content || []
    console.log(latestMessageContent, 'latestMessageContent')

    let latestMessageImageFileId, latestMessageText

    if (latestMessageContent.length === 0) {
      console.log('no message content')
      return
    }

    // 7. Parse message for file id
    for (let i = 0; i < latestMessageContent.length; i ++){
      if(latestMessageContent[i]?.type === 'image_file' ) {
        console.log(latestMessageContent[i], 'image')
        latestMessageImageFileId = latestMessageContent[i].image_file.file_id
      }

      if(latestMessageContent[i]?.type === 'text' ) {
        console.log(latestMessageContent[i], 'text')
        latestMessageText = latestMessageContent[i].text.value
      }
    }

    console.log(latestMessageImageFileId, latestMessageText)
    
    // 8. Pull buffer from file API
    const file = await OpenAIClient.files.content(latestMessageImageFileId);

    console.log(file, 'file');
    console.log(file.body._readableState.buffer[0], 'file.buffer')
    const outputFilePath = 'chart.png';

    const b64 = Buffer.from(file.body._readableState.buffer[0]).toString('base64');
    const mimeType = 'image/png';

    // 9. Return image b64 to front end for rendering
    // Will need some help here - Not sure how to store the image and reflect it on the front end
    // Was initially thinking of just sending it across as part of the response to be rendered in the chat modal as a first cut

  return { type: 'success', user: { id: threadId } , img: `<img src="data:${mimeType};base64,${b64}" />`}
}

export default handler