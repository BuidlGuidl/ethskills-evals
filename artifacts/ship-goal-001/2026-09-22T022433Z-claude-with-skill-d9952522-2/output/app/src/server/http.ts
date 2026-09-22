import { NextResponse } from 'next/server'
import { HttpError } from './session'

/** Wraps a route handler so thrown HttpErrors become clean JSON responses. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse | Response>,
) {
  return async (...args: A) => {
    try {
      return await fn(...args)
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      if (error instanceof Error) {
        console.error(error)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message)
}

export function forbidden(message = 'Not yours'): never {
  throw new HttpError(403, message)
}

export function notFound(message = 'Not found'): never {
  throw new HttpError(404, message)
}
