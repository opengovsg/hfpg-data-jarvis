import { S3Client } from '@aws-sdk/client-s3'
import { env } from '~/env.mjs'

const isLocalEnv = env.NODE_ENV === 'development'

export const s3Client = new S3Client({
  region: 'ap-southeast-1',
  endpoint: isLocalEnv ? 'http://localhost:4566' : undefined,
  forcePathStyle: isLocalEnv,
  credentials: isLocalEnv
    ? {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      }
    : undefined,
})
