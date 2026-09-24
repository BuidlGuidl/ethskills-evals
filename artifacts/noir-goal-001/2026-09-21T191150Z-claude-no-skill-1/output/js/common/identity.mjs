import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { commitmentOf, randomSecret } from "./crypto.mjs";

/**
 * A member identity is one random field element. Whoever holds it can vote
 * as that member, and anyone who learns it can recompute that member's
 * nullifiers and so find their votes. Keep it offline and never send it anywhere.
 */
export function createIdentity(file) {
  const secret = randomSecret();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ secret: secret.toString() }, null, 2) + "\n", { mode: 0o600 });
  return { secret, commitment: commitmentOf(secret) };
}

export function loadIdentity(file) {
  const secret = BigInt(JSON.parse(readFileSync(file, "utf8")).secret);
  return { secret, commitment: commitmentOf(secret) };
}
