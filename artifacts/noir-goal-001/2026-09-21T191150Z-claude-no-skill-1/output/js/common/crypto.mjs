import { randomBytes } from "node:crypto";
import { poseidon1, poseidon2 } from "poseidon-lite";

// BN254 scalar field. Every circuit input/output is an element of it.
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Fresh uniformly random, non-zero identity secret (the only thing a member must keep). */
export function randomSecret() {
  for (;;) {
    // 64 random bytes reduced mod p: negligible bias.
    const s = BigInt("0x" + randomBytes(64).toString("hex")) % FIELD;
    if (s !== 0n) return s;
  }
}

/** Public leaf published at registration. Same as `hash_1([secret])` in the circuit. */
export const commitmentOf = (secret) => poseidon1([secret]);

/** Per-proposal nullifier. Same as `hash_2([secret, scope])` in the circuit. */
export const nullifierOf = (secret, scope) => poseidon2([secret, scope]);

export const hashPair = (l, r) => poseidon2([l, r]);
