import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {HttpError, handler, json, requireMember} from "@/server/http.ts";

/**
 * Tool photos.
 *
 * Written to local disk under `UPLOAD_DIR` and served from `/uploads`. That is the right default
 * for a single-box deployment and the wrong one the moment the app runs on more than one machine
 * or on a platform with an ephemeral filesystem — see "Photos" in the README for the S3 swap.
 * Nothing else in the codebase reads the filesystem, so the change is confined to this file.
 */

const MAX_BYTES = 6 * 1024 * 1024;

/** Sniffed from the file's own bytes, not from the client's content-type header. */
const MAGIC: {ext: string; bytes: number[]}[] = [
  {ext: "jpg", bytes: [0xff, 0xd8, 0xff]},
  {ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47]},
  {ext: "webp", bytes: [0x52, 0x49, 0x46, 0x46]}, // RIFF; WEBP confirmed below
];

function detectExtension(buffer: Buffer): string | null {
  for (const {ext, bytes} of MAGIC) {
    if (bytes.every((byte, index) => buffer[index] === byte)) {
      if (ext === "webp" && buffer.subarray(8, 12).toString("ascii") !== "WEBP") continue;
      return ext;
    }
  }
  return null;
}

export const POST = handler(async (request: Request) => {
  await requireMember();

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a photo.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "That photo is larger than 6 MB.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = detectExtension(buffer);
  if (!extension) throw new HttpError(415, "Photos must be JPEG, PNG or WebP.");

  // Name from random bytes, never from the upload — a client-supplied filename is a path
  // traversal waiting to happen.
  const name = `${crypto.randomBytes(16).toString("hex")}.${extension}`;
  const directory = path.resolve(process.env.UPLOAD_DIR ?? "./public/uploads");
  await fs.mkdir(directory, {recursive: true});
  await fs.writeFile(path.join(directory, name), buffer);

  return json({photoPath: `/uploads/${name}`}, 201);
});
