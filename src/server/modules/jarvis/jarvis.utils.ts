import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { type ChatCompletion } from 'openai/resources'
import { type Logger } from 'pino'

/**
 * Function to normalise all errors that might arise from calling jarvis.service
 *  - Checks if OpenApiResponse has an error and normalises them to the client
 *  - Checks if prisma query was malformed, if it is a malformed invalid query, return that agent cannot find the answer
 *  */
export function normaliseErrors({
  error,
  metadata,
  logger,
}: {
  error: unknown
  metadata: object
  logger: Logger<string>
}) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.log('>> error here', error)
    if (error.code === '42601') {
      logger.warn({ metadata, error }, `Query that cannot be run detected`)
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot generate valid SQL query based on input',
      })
    }
  }

  console.log('>>> error not caught', error, metadata)

  logger.error({ metadata, error }, `Unknown error occurred`)
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unknown error occurred',
  })
}

export type OpenApiRes = OpenApiSuccess | OpenApiFailure

type OpenApiFailure = {
  type: 'failure'
  // TODO: Investigate what function_call and tool_calls are. For now just treat them as failures
  reason: 'length' | 'content_filter' | 'function_call' | 'tool_calls'
}

type OpenApiSuccess = {
  type: 'success'
  response: string
}

// Parse response from OpenAPI. Checks if we have faced any errors from `finish_reason` and map them to comprehensible errors on our end
export function parseOpenApiResponse(chatResponse: ChatCompletion): OpenApiRes {
  const latestResponse = chatResponse.choices[0]!

  const finishReason = latestResponse.finish_reason

  if (finishReason !== 'stop') {
    return {
      type: 'failure',
      reason: finishReason,
    }
  }

  return {
    type: 'success',
    response: latestResponse.message.content ?? '',
  }
}
