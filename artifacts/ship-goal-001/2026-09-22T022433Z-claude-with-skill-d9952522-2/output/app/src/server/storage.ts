import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

/**
 * Photo storage behind a two-function interface: `savePhoto` / `photoPath`.
 *
 * Local disk is enough for one neighbourhood (a few hundred photos), and it
 * keeps the dev setup to zero services. For a hosted deploy on ephemeral disks,
 * replace these two functions with S3/R2 put + signed GET; nothing else in the
 * app touches the filesystem.
 */

// turbopackIgnore keeps Next from tracing the whole project because of this
// configurable path; nothing here is imported at build time.
const uploadDir = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? './data/uploads')

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
])

export const MAX_PHOTO_BYTES = 6 * 1024 * 1024

export class PhotoError extends Error {}

export async function savePhoto(file: File): Promise<string> {
  const extension = ALLOWED.get(file.type)
  if (!extension) throw new PhotoError('Photo must be a JPEG, PNG or WebP image')
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError('Photo must be smaller than 6 MB')

  mkdirSync(uploadDir, { recursive: true })
  const key = `${randomUUID()}${extension}`
  await writeFile(join(uploadDir, key), Buffer.from(await file.arrayBuffer()))
  return key
}

/** Resolves a stored key to a path, refusing anything that escapes the upload dir. */
export function photoPath(key: string): string | undefined {
  if (!/^[A-Za-z0-9-]+\.(jpg|png|webp)$/.test(key)) return undefined
  const path = join(uploadDir, key)
  return existsSync(path) ? path : undefined
}

export function photoStream(path: string) {
  return createReadStream(path)
}

export function contentTypeFor(key: string): string {
  switch (extname(key)) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    default:
      return 'image/jpeg'
  }
}
