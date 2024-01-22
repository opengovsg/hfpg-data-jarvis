/** Throw this error is the query is invalid */
export class InvalidQueryError extends Error {
  constructor(sqlQuery: string, customMessage?: string) {
    const msg = `Invalid query: ${sqlQuery}`

    if (!!customMessage) {
      msg.concat(customMessage)
    }

    super(msg)
  }
}

export class UnauthorisedDbAccess extends Error {
  constructor(sqlQuery: string, message: string) {
    super(`Unauthorised query: ${sqlQuery}, message: ${message}`)
  }
}

export class ExpensiveError extends Error {
  constructor(cost: number, sqlQuery: string) {
    super(`Query was too expensive at ${cost}ms, query: ${sqlQuery}`)
  }
}

// TODO: Throw this error from response
export class TokenExceededError extends Error {
  constructor(tokenCount: number) {
    super(`Token count exceeded at ${tokenCount}`)
  }
}

// Instead of relying on zod and error messages on the client, we do this to return a chat response as it is more "human"
export class ClientInputError extends Error {
  constructor(type: 'too_short' | 'too_long') {
    if (type === 'too_long') {
      super('Question is too long, please rephrase your question')
    }
    super('Question is too short, please rephrase your question')
  }
}

export class UnableToGenerateSuitableResponse extends Error {
  constructor(message = 'Unable to generate suitable response') {
    super(message)
  }
}

export class NamedEntityParsingError extends Error {
  constructor(response: string) {
    super(
      `Unable to parse the follow response for named entity recognition: ${response}`,
    )
  }
}

export class TooManyEntitiesError extends Error {
  constructor(readonly entities: string[]) {
    super(`Too many locations detected: ${entities}`)
  }
}
