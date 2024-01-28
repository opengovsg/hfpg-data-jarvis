import { OpenAIClient } from '~/server/modules/watson/open-ai'
import { type PrismaClient } from '@prisma/client'
import { type ChatCompletion } from 'openai/resources'
import { z } from 'zod'
import {
  ClientInputError,
  ExpensiveError,
  InvalidQueryError,
  TokenExceededError,
  UnauthorisedDbAccess,
} from './watson.errors'

import { astVisitor, parse, type Statement } from 'pgsql-ast-parser'
import { VALID_TABLE_NAMES } from '../prompt/sql/types'
import { type ChatHistoryGroup } from './watson.types'
import * as dateFns from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import { type Logger } from 'pino'
import { create } from "lodash";
import OpenAI from "openai";

 const openai = new OpenAI({ apiKey: 'sk-insertakeyherebutdonotactuallyusetherealvalue',dangerouslyAllowBrowser: true})

export const doesPromptExceedTokenLimit = (prompt: string) => {
  // appromximation that 4 char === 1 token
  return Math.floor(prompt.length / 4) > 4096
}

/**
 * Function to normalise all errors that might arise from calling jarvis.service
 *  - Checks if OpenApiResponse has an error and normalises them to the client
 *  - Checks if prisma query was malformed, if it is a malformed invalid query, return that agent cannot find the answer
 *  */
export function generateResponseFromErrors({
  error,
  question,
  logger,
}: {
  error: unknown
  question: string
  logger?: Logger<string>
}): string {
  // TODO: Find a way to have a pino logger for this
  logger?.warn({ error, question }, 'Error occurred')

  if (error instanceof TokenExceededError || error instanceof ExpensiveError) {
    return `I’m sorry, I wasn’t able to process that. How about rephrasing or narrowing down your question?`
  }

  if (error instanceof UnauthorisedDbAccess) {
    return `My apologies, I can’t help you with that. If you have another question in mind, do feel free to ask me!`
  }

  if (error instanceof ClientInputError) {
    return error.message
  }

  return `Unfortunately, that’s not something I would know. If you’d like, try phrasing your question differently or asking me a new one! `
}

export type OpenAi = OpenAiSuccess | OpenAiFailure

type OpenAiFailure = {
  type: 'failure'
  // TODO: Investigate what function_call and tool_calls are. For now just treat them as failures
  reason: 'length' | 'content_filter' | 'function_call' | 'tool_calls'
}

type OpenAiSuccess = {
  type: 'success'
  response: string
}

// Parse response from OpenAI. Checks if we have faced any errors from `finish_reason` and map them to comprehensible errors on our end
export function parseOpenAiResponse(
  question: string,
  chatResponse: ChatCompletion,
): OpenAi {
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
 * NOTE: This parses the query and retrieves the type of operation and table names accessed to make sure
 * we have READ-only access to table names.
 *
 * WE ACHIEVE DO THE SAME BY HAVING A PG DB-USER WHICH ALLOWS FOR READ-ONLY ACCESS TO CERTAIN TABLES ONLY
 *
 * THIS IS AN APPROACH TO TRY AND HAVE ALL LOGIC IN APPLICATION CODE, INSTEAD OF TRYING TO MANAGE THINGS IN DB LAYER
 *
 * For production we can use this as a redundant protection layer only to tell developers in local dev to keep this logic in sync with database permissions just for maintainability purpose
 *
 * Assert the following:
 * - Query is READ only operation
 * - Query only selects tables that are whitelisted from `VALID_TABLE_NAMES`
 */
export function assertReadOnlyValidTablesAccess(query: string) {
  try {
    const queriedTables: Set<string> = new Set()
    const statementTypes: Set<Statement['type']> = new Set()

    const visitor = astVisitor(() => ({
      tableRef: (t) => queriedTables.add(t.name),
    }))

    // start traversing a statement
    const statements = parse(query)

    for (const statement of statements) {
      visitor.statement(statement)
      statementTypes.add(statement.type)
    }

    /**
     * Step 1: Check that this only contains READ operations
     * Check if after removal of 'select' statement types, other statement types still exist
     */

    statementTypes.delete('select')
    if (statementTypes.size > 0) {
      throw new UnauthorisedDbAccess(
        query,
        `Query contains non-read operations of: [${[...statementTypes].join(
          ', ',
        )}]`,
      )
    }

    /**
     * Step 2: Check if only contains read operations from valid tables, otherwise throw error
     */
    const validTableNames = new Set(VALID_TABLE_NAMES) as unknown as Set<string>

    const restrictedTablesAccess: string[] = []

    for (const queriedTable of queriedTables) {
      if (!validTableNames.has(queriedTable)) {
        restrictedTablesAccess.push(queriedTable)
      }
    }

    if (restrictedTablesAccess.length > 0) {
      throw new UnauthorisedDbAccess(
        query,
        `Query trying to access restricted tables of ${JSON.stringify(
          restrictedTablesAccess,
        )}`,
      )
    }

    // print result
    return `Used tables ${[...queriedTables].join(', ')} !`
  } catch (e) {
    if (e instanceof UnauthorisedDbAccess) {
      throw e
    }

    /**
     * The `pgsql-ast-parser` does not allow for catching custom errors and only throw a generic `Error` class
     * for now we dont deal with switch casing every `Error` message, and just treat all errors thrown by parser as `InvalidQueryError`
     *
     * TODO: Understand source-code of `pgsql-ast-parser` and see if there's a way to extract meaningful error messages. Their error message logic is not written in JS.
     * */
    let msg = `Unexpected error with SQL AST parser`

    if (e instanceof Error) {
      msg = e.message
    }

    throw new InvalidQueryError(query, msg)
  }
}

/**
 * Checks if query is runnable and whether it is expensive
 */
export async function assertValidAndInexpensiveQuery(
  query: string,
  prisma: PrismaClient,
) {
  // STEP 1: Assert if query is authorised to access table and that it only contains READ operations
  assertReadOnlyValidTablesAccess(query)

  try {
    // STEP 2: Check if it is expensive (beyond 6 seconds for now)
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
    throw new InvalidQueryError(query)
  }
}

export const mapDateToChatHistoryGroup = (
  dateToCompare: Date,
): ChatHistoryGroup => {
  const today = new Date()
  const today_utc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    today.getUTCHours(),
    today.getUTCMinutes(),
    today.getUTCSeconds(),
  )

  const tz = 'Asia/Singapore'
  const dateToCompareInSgt = utcToZonedTime(dateToCompare, tz)
  const todayInSgt = utcToZonedTime(today_utc, tz)

  const diffInDays = dateFns.differenceInBusinessDays(
    todayInSgt,
    dateToCompareInSgt,
  )

  if (diffInDays < 1) {
    return 'Today'
  } else if (diffInDays <= 1) {
    return 'Yesterday'
  } else if (
    dateFns.differenceInBusinessDays(todayInSgt, dateToCompareInSgt) <= 30
  ) {
    return 'Previous 30 Days'
  }

  return 'Older'
}
