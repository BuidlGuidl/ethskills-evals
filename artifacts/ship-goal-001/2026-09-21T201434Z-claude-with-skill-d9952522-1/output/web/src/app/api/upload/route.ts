import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AuthError, requireApprovedMember, requireSigner } from "@/core/auth";

export const dynamic = "force-dynamic";

/**
 * Tool photos.
 *
 * Local disk is the right call for a single-box neighborhood deployment, and
 * it keeps the dev setup to `npm run dev` with nothing to provision. If you
 * deploy somewhere with an ephemeral filesystem (Vercel, Fly without a volume)
 * swap this route's body for an S3/R2 presigned upload — nothing else in the
 * app cares where `photoUrl` points.
 */

const UPLOAD_DIR = resolve(process.env.TOOLSHED_UPLOAD_DIR ?? "./public/uploads");
const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    // The signed fields ride alongside the file in the same multipart body.
    const address = await requireSigner("upload-photo", {
      address: String(form.get("address") ?? ""),
      nonce: String(form.get("nonce") ?? ""),
      issuedAt: Number(form.get("issuedAt") ?? 0),
      signature: String(form.get("signature") ?? "") as `0x${string}`,
    });
    requireApprovedMember(address);

    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "file is larger than 6MB" }, { status: 413 });

    const ext = ALLOWED.get(file.type);
    if (!ext) return NextResponse.json({ error: "only jpeg, png or webp" }, { status: 415 });

    // Name the file ourselves; never trust the client-supplied filename.
    const name = `${randomUUID()}.${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(resolve(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "upload failed" }, { status: 400 });
  }
}
