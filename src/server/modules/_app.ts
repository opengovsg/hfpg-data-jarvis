/**
 * This file contains the root router of your tRPC-backend
 */
import { publicProcedure, router } from '../trpc'
import { meRouter } from './me/me.router'
import { authRouter } from './auth/auth.router'
import { profileRouter } from './profile/profile.router'
import { jarvisRouter } from './jarvis/jarvis.router'

export const appRouter = router({
  healthcheck: publicProcedure.query(() => 'yay!'),
  me: meRouter,
  jarvis: jarvisRouter,
  auth: authRouter,
  profile: profileRouter,
})

export type AppRouter = typeof appRouter
