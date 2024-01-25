import '@tensorflow/tfjs'
import { load } from '@tensorflow-models/universal-sentence-encoder'
import { OpenAIClient } from './open-ai'

// TODO: Use this next time, right now `model.load()` takes about ~5 seconds, adding lots of latency to our rseponse
export async function generateEmbedding(sentence: string) {
  const model = await load()

  const embeddings = await model.embed(sentence)

  return embeddings.arraySync()[0]!
}

// TODO: Make generate embedding hit some kind of redis cache of question <> embedding mapping so we dont get charged for double calls
export async function generateEmbeddingFromOpenAi(sentence: string) {
  const embedding = await OpenAIClient.embeddings.create({
    model: 'text-embedding-ada-002',
    input: sentence,
    encoding_format: 'float',
  })

  return embedding.data[0]!.embedding
}
