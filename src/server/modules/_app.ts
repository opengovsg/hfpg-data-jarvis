/**
 * This file contains the root router of your tRPC-backend
 */
import { publicProcedure, router } from '../trpc'
import { meRouter } from './me/me.router'
import { authRouter } from './auth/auth.router'
import { profileRouter } from './profile/profile.router'
import { watsonRouter } from './watson/watson.router'

export const appRouter = router({
  healthcheck: publicProcedure.query(() => 'yay!'),
  me: meRouter,
  watson: watsonRouter,
  auth: authRouter,
  profile: profileRouter,
})

export type AppRouter = typeof appRouter
