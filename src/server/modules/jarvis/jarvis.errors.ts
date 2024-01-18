export class MalformedError extends Error {
  constructor(sqlQuery: string) {
    super(`Malformed query: ${sqlQuery}`)
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

export class TokenExceededError extends Error {
  constructor(private readonly tokenCount: number) {
    super(`Token count exceeded at ${tokenCount}`)
  }

  toJSON() {
    return this.message
  }
}
