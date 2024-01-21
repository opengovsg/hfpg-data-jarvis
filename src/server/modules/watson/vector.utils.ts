import '@tensorflow/tfjs'
import { load } from '@tensorflow-models/universal-sentence-encoder'
import { OpenApiClient } from './open-api.service'

// TODO: Use this next time, right now `model.load()` takes about ~5 seconds, adding lots of latency to our rseponse
export async function generateEmbedding(sentence: string) {
  const model = await load()

  const embeddings = await model.embed(sentence)

  return embeddings.arraySync()[0]!
}

export async function generateEmbeddingFromOpenApi(sentence: string) {
  const embedding = await OpenApiClient.embeddings.create({
    model: 'text-embedding-ada-002',
    input: sentence,
    encoding_format: 'float',
  })

  return embedding.data[0]!.embedding
}
