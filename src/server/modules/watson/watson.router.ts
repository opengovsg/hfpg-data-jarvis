import { protectedProcedure, router } from '~/server/trpc'
import { z } from 'zod'
import {
  generateMatPlotLibCode,
  mapDateToChatHistoryGroup,
} from './watson.utils'
import _ from 'lodash'
import { prisma, readonlyWatsonPrismaClient } from '~/server/prisma'
import { FAKE_CHAT_ID } from '~/components/ChatWindow/chat-window.atoms'
import { TRPCError } from '@trpc/server'
import { getTableColumnMetadata } from '../prompt/sql/sql.utils'
import { s3Client } from '../s3.service'
import { PyodideService } from './chart.service'
import { v4 } from 'uuid'
import { env } from '~/env.mjs'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const tableDataQuerySchema = z.array(z.record(z.unknown()))

// TODO: Add RBAC to this whole layer in the future
export const watsonRouter = router({
  getTableInfo: protectedProcedure.query(async ({ ctx: { prisma } }) => {
    const colMetadata = await getTableColumnMetadata(
      'hdb_resale_transaction',
      prisma,
    )
    const sampleData = await prisma.hdbResaleTransaction.findMany({ take: 5 })

    return {
      colMetadata,
      sampleData,
    }
  }),
  getPastConversations: protectedProcedure.query(
    async ({ ctx: { prisma, user } }) => {
      const pastConversations = await prisma.conversation.findMany({
        where: { userId: user.id },
        select: { id: true, title: true, latestChatMessageAt: true },
      })

      const convosWithBuckets = pastConversations.map((convo) => ({
        ...convo,
        lastUpdatedAtBucket: mapDateToChatHistoryGroup(
          convo.latestChatMessageAt,
        ),
        latestChatMessageAt: convo.latestChatMessageAt,
      }))

      return _.groupBy(
        convosWithBuckets,
        ({ lastUpdatedAtBucket }) => lastUpdatedAtBucket,
      )
    },
  ),
  createConversation: protectedProcedure
    .input(z.object({ question: z.string() }))
    .mutation(async ({ ctx: { user }, input: { question } }) => {
      return await prisma.conversation.create({
        data: { userId: user.id, title: question.slice(0, 30) },
        select: { id: true },
      })
    }),
  getChatMessagesForConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(
      async ({
        ctx: {
          prisma,
          user: { id: userId },
        },
        input: { conversationId },
      }) => {
        // Hack for initial convo
        if (conversationId === FAKE_CHAT_ID) return []

        const conversation = await prisma.conversation.findFirstOrThrow({
          where: { id: conversationId, userId },
        })

        const chatMessages = await prisma.chatMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
          select: {
            rawMessage: true,
            type: true,
            suggestions: true,
            sqlQuery: true,
            visualisedGraphS3ObjectKey: true,
            badResponseReason: true,
            isGoodResponse: true,
            question: true,
            id: true,
            createdAt: true,
          },
        })

        return chatMessages
      },
    ),
  updateConversationTitle: protectedProcedure
    .input(z.object({ conversationId: z.number(), title: z.string() }))
    .mutation(
      async ({
        ctx: {
          prisma,
          user: { id: userId },
        },
        input: { conversationId, title },
      }) => {
        await prisma.conversation.update({
          where: { id: conversationId, userId },
          data: { title },
        })
      },
    ),
  // TODO: Add rate limiting in the future
  // TODO: Add RBAC in the future, technically anyone can rate aynones responses atm
  rateResponse: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        isGoodResponse: z.boolean(),
        badResponseReason: z.string().max(300).optional(),
      }),
    )
    .mutation(
      async ({
        ctx: {
          prisma,
          user: { id: requestUserId },
        },
        input: { messageId, isGoodResponse, badResponseReason },
      }) => {
        const { conversationId } = await prisma.chatMessage.findFirstOrThrow({
          where: { id: messageId },
          select: { conversationId: true },
        })

        const { userId } = await prisma.conversation.findFirstOrThrow({
          where: { id: conversationId },
          select: { userId: true },
        })

        if (userId !== requestUserId) {
          throw new TRPCError({ code: 'UNAUTHORIZED' })
        }

        await prisma.chatMessage.update({
          where: { id: messageId },
          data: {
            isGoodResponse,
            badResponseReason,
          },
        })
      },
    ),
  getTable: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        limit: z.number(),
        offset: z.number(),
      }),
    )
    .query(async ({ ctx: { user }, input: { messageId, limit, offset } }) => {
      const { sqlQuery } = await prisma.chatMessage.findFirstOrThrow({
        where: { id: messageId, conversation: { userId: user.id } },
        select: {
          sqlQuery: true,
        },
      })

      if (sqlQuery === null)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'sql query not defined for this agent message',
        })

      // TODO: check for security vulerabilities
      // TODO: check how to improve perf for this, this is super hacky MVP query that might not use indexes etc
      const res = await readonlyWatsonPrismaClient.$queryRawUnsafe(
        `SELECT * FROM (${sqlQuery.replaceAll(';', '')}) a LIMIT ${
          // we add a + 1 here so that we know whether we can navigate to next page
          limit + 1
        } OFFSET ${offset * limit}`,
      )

      const tableRecords = tableDataQuerySchema.safeParse(res)

      if (!tableRecords.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'sql query response is of unexpected format',
        })
      }

      return {
        data: tableRecords.data.slice(0, 10),
        hasNext: tableRecords.data.length > 10,
      }
    }),
  getGraphs3ObjectKeyByMessageId: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .query(async ({ input: { messageId }, ctx: { user, prisma } }) => {
      const { visualisedGraphS3ObjectKey } =
        await prisma.chatMessage.findFirstOrThrow({
          where: { id: messageId, conversation: { userId: user.id } },
          select: { visualisedGraphS3ObjectKey: true },
        })

      return { s3ObjectKey: visualisedGraphS3ObjectKey }
    }),
  getGraphPresignedUrl: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .query(async ({ input: { messageId }, ctx: { user, prisma } }) => {
      const { visualisedGraphS3ObjectKey } =
        await prisma.chatMessage.findFirstOrThrow({
          where: { id: messageId, conversation: { userId: user.id } },
          select: { visualisedGraphS3ObjectKey: true },
        })

      if (visualisedGraphS3ObjectKey === null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No s3 object key for message id',
        })
      }

      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: visualisedGraphS3ObjectKey,
      })

      // expires in an hour
      return getSignedUrl(s3Client, command, { expiresIn: 3600 })
    }),

  // TODO: make this async job, in interest of time just assume keeping a connection alive of ~30s will suffice for demo day
  generateGraph: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(
      async ({
        input: { messageId },
        ctx: { user, prisma, logger },
      }): Promise<{ s3ObjectKey: string; messageId: number }> => {
        // if already has valid visualisation, just return previous response
        const { visualisedGraphS3ObjectKey } =
          await prisma.chatMessage.findFirstOrThrow({
            where: { id: messageId, conversation: { userId: user.id } },
            select: { visualisedGraphS3ObjectKey: true },
          })

        if (!!visualisedGraphS3ObjectKey) {
          return {
            s3ObjectKey: visualisedGraphS3ObjectKey,
            messageId,
          }
        }

        const matplotLibCode = await generateMatPlotLibCode({
          messageId,
          prisma,
          // TODO: Make this an input when we support more tables
          table: 'hdb_resale_transaction',
          userId: user.id,
        })

        const pyodide = await PyodideService()

        try {
          const base64JpegHash: string =
            await pyodide.runPythonAsync(matplotLibCode)

          const buffer = Buffer.from(base64JpegHash, 'base64')

          const s3ObjectKey = `${user.id}/graphs/${v4()}.jpg`

          await s3Client.send(
            new PutObjectCommand({
              Bucket: env.S3_BUCKET_NAME,
              Body: buffer,
              ContentEncoding: 'base64',
              ContentType: 'image/jpeg',
              Key: s3ObjectKey,
            }),
          )

          logger.info(
            { s3ObjectKey, bucket: env.S3_BUCKET_NAME },
            'Successfully uploaded to s3 bucket',
          )

          await prisma.chatMessage.update({
            where: { id: messageId },
            data: { visualisedGraphS3ObjectKey: s3ObjectKey },
          })

          return { s3ObjectKey, messageId }
        } catch (e) {
          let message = `Unexpected error occurred`
          if (e instanceof TRPCError) {
            throw e
          }

          if (e instanceof Error) {
            message = e.message
          }

          logger.error({ messageId, userId: user.id }, message)

          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
        }
      },
    ),
})
