import { protectedProcedure, router } from '~/server/trpc'
import { getTableInfo } from '../langchain/sql/getTablePrompt'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { env } from '~/env.mjs'
import { askQuestionSchema } from './jarvis.schema'

export const jarvisRouter = router({
  get: protectedProcedure
    .input(askQuestionSchema)
    .query(async ({ ctx: { prisma }, input: { question } }) => {
      // const tablePrompt = await getTablePrompt('HdbResaleTransaction', prisma)
      const llm = new ChatOpenAI({ openAIApiKey: env.OPEN_API_KEY })

      const prompt =
        PromptTemplate.fromTemplate(`You are a PostgreSQL expert. Based on the provided SQL table schema below, write a PostgreSQL query that would answer the user's question.

        Never query for all columns from a table. You must query only the columns that are needed to answer the question. You must wrap each column name in double quotes (") to denote them as delimited identifiers.
Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.

------------
SCHEMA: {schema}
------------
QUESTION: {question}
------------
SQL QUERY:`)

      // TODO: This prompt seems p shitty, but ill just use it since its from langchain, to experiment own prompts in the future
      const sqlQueryChain = RunnableSequence.from([
        {
          schema: async () =>
            await getTableInfo('HdbResaleTransaction', prisma),
          question: () => question,
        },
        prompt,
        llm.bind({ stop: ['SQLQuery:\n'] }),
        new StringOutputParser(),
      ])

      const generatedQuery = await sqlQueryChain.invoke({ question })
      console.log('Generated Query: ', generatedQuery)

      const fixPostgresPrompt = PromptTemplate.fromTemplate(
        `Can you fix the PostgreSQL query below by enclosing all column names in double quotes (")
        
        -------------
        QUERY: {query}
        ------------
SQL QUERY:`,
      )

      const fixedQueryChain = RunnableSequence.from([
        {
          query: () => generatedQuery,
        },
        fixPostgresPrompt,
        llm.bind({ stop: ['SQLQuery:\n'] }),
        new StringOutputParser(),
      ])

      const fixedQuery = await fixedQueryChain.invoke({ query: generatedQuery })

      console.log('Fixee query: ', fixedQuery)

      const finalResponsePrompt =
        PromptTemplate.fromTemplate(`Based on the table schema below, question, SQL query, and SQL response, write a natural language response:
    ------------
    SCHEMA: {schema}
    ------------
    QUESTION: {question}
    ------------
    SQL QUERY: {query}
    ------------
    SQL RESPONSE: {response}
    ------------
    NATURAL LANGUAGE RESPONSE:`)

      /**
       * Create a new RunnableSequence where we pipe the output from the previous chain, the users question,
       * and the SQL query, into the prompt template, and then into the llm.
       * Using the result from the `sqlQueryChain` we can run the SQL query via `db.run(input.query)`.
       */
      const finalChain = RunnableSequence.from([
        {
          question: () => question,
          query: fixedQueryChain,
        },
        {
          schema: async () =>
            await getTableInfo('HdbResaleTransaction', prisma),
          question: () => question,
          query: (input) => input.query,
          // TODO: Explore if there are vulnerabilities here
          response: async (input) => {
            const res = await prisma.$queryRawUnsafe(input.query)
            console.log('>>> response', res)
            return JSON.stringify(res)
          },
        },
        finalResponsePrompt,
        llm,
        new StringOutputParser(),
      ])

      const finalResponse = await finalChain.invoke({
        question: 'How many employees are there?',
      })

      return finalResponse
    }),
})
