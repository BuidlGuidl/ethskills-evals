// A member's voting identity: one random field element, never shown to anyone.
import { randomBytes } from "node:crypto";
import { FIELD_MODULUS, poseidon2 } from "./poseidon.js";

/** Uniform field element by rejection sampling — no modulo bias. */
export function randomSecret() {
  for (;;) {
    const candidate = BigInt("0x" + randomBytes(32).toString("hex"));
    if (candidate < FIELD_MODULUS && candidate !== 0n) return candidate;
  }
}

/** The public leaf. Hiding: reveals nothing about the secret. */
export const commitment = (secret) => poseidon2([secret]);

/**
 * The double-vote tag for one proposal. Deterministic in (secret, context) so
 * a member cannot vote twice, and uncorrelated across proposals so their
 * ballots on different proposals cannot be tied together.
 */
export const nullifier = (secret, proposalContext) => poseidon2([secret, proposalContext]);
