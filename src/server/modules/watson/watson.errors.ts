/** Throw this error is the query is invalid */
export class InvalidQueryError extends Error {
  constructor(sqlQuery: string, customMessage?: string) {
    const msg = `Invalid query: ${sqlQuery}`

    if (!!customMessage) {
      msg.concat(customMessage)
    }

    super(msg)
  }

  toJSON() {
    return this.message
  }
}

export class UnauthorisedDbAccess extends Error {
  constructor(sqlQuery: string, message: string) {
    super(`Unauthorised query: ${sqlQuery}, message: ${message}`)
  }

  toJSON() {
    return this.message
  }
}

export class ExpensiveError extends Error {
  constructor(cost: number, sqlQuery: string) {
    super(`Query was too expensive at ${cost}ms, query: ${sqlQuery}`)
  }

  toJSON() {
    return this.message
  }
}

// TODO: Throw this error from response
export class TokenExceededError extends Error {
  constructor(tokenCount: number) {
    super(`Token count exceeded at ${tokenCount}`)
  }

  toJSON() {
    return this.message
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

  toJSON() {
    return this.message
  }
}
