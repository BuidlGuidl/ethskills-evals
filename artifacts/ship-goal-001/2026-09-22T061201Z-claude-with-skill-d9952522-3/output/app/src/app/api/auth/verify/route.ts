import {verifyMessage} from "viem";

import {HttpError, handler, json, requireAddress, requireString} from "@/server/http.ts";
import {consumeNonce, signInMessage, startSession} from "@/server/session.ts";
import {signIn} from "@/server/members.ts";

/**
 * Step 2 of sign-in: check the signature against the nonce we issued, then check the address is
 * actually on the association's member list.
 *
 * Owning a wallet proves who you are; it does not make you a neighbour.
 */
export const POST = handler(async (request: Request) => {
  const body = (await request.json()) as Record<string, unknown>;
  const address = requireAddress(body.address, "address");
  const nonce = requireString(body.nonce, "nonce", 64);
  const signature = requireString(body.signature, "signature", 2_000);

  if (!consumeNonce(address, nonce)) {
    throw new HttpError(400, "That sign-in request expired. Try again.");
  }

  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message: signInMessage(address, nonce),
    signature: signature as `0x${string}`,
  });
  if (!valid) throw new HttpError(401, "Signature did not match that address.");

  const result = signIn(address);
  if (!result.ok) throw new HttpError(403, result.reason);

  await startSession(address);
  return json({member: result.member});
});
