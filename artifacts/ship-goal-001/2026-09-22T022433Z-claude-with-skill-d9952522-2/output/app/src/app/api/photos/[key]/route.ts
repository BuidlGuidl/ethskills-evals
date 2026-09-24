import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { handler, notFound } from '@/server/http'
import { contentTypeFor, photoPath } from '@/server/storage'

/** Serves listing photos from the upload directory. */
export const GET = handler(async (_req: Request, context: { params: Promise<{ key: string }> }) => {
  const { key } = await context.params
  const path = photoPath(key)
  if (!path) notFound('No such photo')

  const body = await readFile(path)
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentTypeFor(key),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
