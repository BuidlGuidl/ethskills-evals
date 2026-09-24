"use client";

import type { Address } from "viem";
import { authMessage } from "./auth-message";

/**
 * Client half of the signed-write scheme in `src/core/auth.ts`. Produces the
 * three fields the server checks, using whatever wallet is connected.
 */

export type SignMessageFn = (args: { account: Address; message: string }) => Promise<`0x${string}`>;

export async function signedFields(action: string, address: Address, signMessage: SignMessageFn) {
  const nonce = crypto.randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);
  const signature = await signMessage({
    account: address,
    message: authMessage(action, address, nonce, issuedAt),
  });
  return { address, nonce, issuedAt, signature };
}

export async function signedPost<T>(
  url: string,
  action: string,
  address: Address,
  signMessage: SignMessageFn,
  body: Record<string, unknown>,
  method: "POST" | "PATCH" = "POST",
): Promise<T> {
  const auth = await signedFields(action, address, signMessage);
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, ...auth }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `request failed (${res.status})`);
  return json as T;
}

export async function signedUpload(
  file: File,
  address: Address,
  signMessage: SignMessageFn,
): Promise<string> {
  const auth = await signedFields("upload-photo", address, signMessage);
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(auth)) form.append(key, String(value));

  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "upload failed");
  return json.url as string;
}
