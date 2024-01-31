# Derived from https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
# We will manually run postinstall later, since it depends on actual source code
RUN npm ci --ignore-scripts

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run postinstall
RUN SKIP_ENV_VALIDATION=true npx next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_MANUAL_SIG_HANDLE true

# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# TODO: RM this hack after hackathon
COPY --from=builder /app/node_modules/pyodide ./node_modules/pyodide

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# TODO: Find the CORRECT and exact permissions for node_modules/pyodide. Doing 777 IS REALLY BAD security wise
# prevent EACCESS errors by giving read, write and execute access to node_modules from pyodide
RUN chmod -R 777 node_modules
RUN -R chmod +rwx node_modules
RUN -R nextjs:nodejs node_modules
RUN -R node:node node_modules

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static


USER nextjs

EXPOSE 8080

ENV PORT 8080

CMD ["node", "server.js"]