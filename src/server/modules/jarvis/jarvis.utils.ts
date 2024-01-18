import { type PrismaClient } from '@prisma/client'
import { type ChatCompletion } from 'openai/resources'
import { type Logger } from 'pino'
import { z } from 'zod'
import {
  ExpensiveError,
  MalformedError,
  TokenExceededError,
} from './jarvis.errors'

/**
 * Function to normalise all errors that might arise from calling jarvis.service
 *  - Checks if OpenApiResponse has an error and normalises them to the client
 *  - Checks if prisma query was malformed, if it is a malformed invalid query, return that agent cannot find the answer
 *  */
export function generateResponseFromErrors({
  error,
  metadata,
  logger,
}: {
  error: unknown
  metadata: object
  logger: Logger<string>
}): string {
  logger.warn({ metadata, error }, 'Error occurred')
  console.log('>> error', error)

  if (error instanceof TokenExceededError) {
    return 'The data returned from your question was too long to be comprehensible. Please try aggregating or adding filters to your search.'
  }

  if (error instanceof ExpensiveError) {
    return `It took too long to get data for your question. Please try adding filters to your question to narrow down your search.`
  }

  // TODO: This just means the response could be something other than an SQL query
  return 'We are unable to generate an answer to your question. Could you try rephrasing it?'
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
export function parseOpenApiResponse(
  question: string,
  chatResponse: ChatCompletion,
): OpenApiRes {
  const latestResponse = chatResponse.choices[0]!

  const finishReason = latestResponse.finish_reason

  if (finishReason === 'length') {
    // This is an approximation
    throw new TokenExceededError(Math.floor(question.length / 4))
  }

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

export const queryPlanSchema = z.array(
  z.object({
    'QUERY PLAN': z.string(),
  }),
)

/**
 * Checks if query is runnable and whether it is expensive
 */
export async function assertValidAndInexpensiveQuery(
  query: string,
  prisma: PrismaClient,
) {
  try {
    const explanation = await prisma.$queryRawUnsafe(`EXPLAIN ${query}`)

    const parsedExplanation = queryPlanSchema.parse(explanation)

    let explainedQueryRes = ``

    parsedExplanation.map((res) => (explainedQueryRes += res['QUERY PLAN']))

    // Regular expression pattern to extract the query cost
    const costPattern = /cost=([\d.]+)\.\.([\d.]+)/

    // Find the match in the EXPLAIN output
    const match = explainedQueryRes.match(costPattern)

    // Assume this regex always passes
    if (match) {
      // TODO: We just assume that the regex above will get the correct cost, otherwise cost will be 0
      const endCost = parseFloat(match[2]! ?? 0)

      // If query takes more than 6s to run, we abort
      if (endCost > 6000) {
        throw new ExpensiveError(endCost, query)
      }
    }
  } catch (e) {
    if (e instanceof ExpensiveError) {
      throw e
    }
    // TODO: We assume all errors are malformed for now. somehow Prisma's instanceof operator does not catch the right error
    // Anyway this is hacky MVP so w/e for now

    /**
     * Types of errors to handle in the future:
     * - Prisma query errors, error.code of 42601
     * - Zod parse errors in case explanation of query is of an incorrect schema.
     */
    throw new MalformedError(query)
  }
}
