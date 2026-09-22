import {handler, json, requireAddress} from "@/server/http.ts";
import {issueNonce, signInMessage} from "@/server/session.ts";
import {migrate} from "@/server/db.ts";

/** Step 1 of sign-in: hand the wallet a single-use nonce and the exact message to sign. */
export const GET = handler(async (request: Request) => {
  migrate();
  const address = requireAddress(
    new URL(request.url).searchParams.get("address"),
    "address",
  );
  const nonce = issueNonce(address);
  return json({nonce, message: signInMessage(address, nonce)});
});
