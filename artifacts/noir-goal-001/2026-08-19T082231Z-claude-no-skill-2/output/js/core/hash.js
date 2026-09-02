import { createHash } from "node:crypto";

/**
 * Upper bound on every value in this system: 2^248.
 *
 * Truncating SHA-256 to 248 bits keeps every hash comfortably below the BN254 scalar
 * field modulus (~2^254) with no modular reduction and therefore no bias. Anything at
 * or above this cannot be a Merkle leaf. See FieldHash.sol and circuits/vote/src/hash.nr.
 */
export const FIELD_BOUND = 1n << 248n;

/** Normalise a bigint / 0x-string / Uint8Array into a 32-byte big-endian buffer. */
export function toBytes32(value) {
  let v;
  if (typeof value === "bigint") v = value;
  else if (typeof value === "number") v = BigInt(value);
  else if (typeof value === "string") v = BigInt(value);
  else if (value instanceof Uint8Array) v = BigInt("0x" + Buffer.from(value).toString("hex"));
  else throw new TypeError(`cannot convert ${typeof value} to a field element`);
  if (v < 0n || v >= 1n << 256n) throw new RangeError("value does not fit in 32 bytes");
  return Buffer.from(v.toString(16).padStart(64, "0"), "hex");
}

/** 0x-prefixed 32-byte hex, the form the contracts and the circuit want. */
export function toHex32(value) {
  return "0x" + toBytes32(value).toString("hex");
}

/**
 * The project's one hash: SHA-256 over the big-endian concatenation of its inputs,
 * truncated to the top 31 bytes.
 *
 * Identical to `FieldHash` in Solidity and to `hash1`/`hash2` in the Noir circuit.
 * Arity is implicitly domain-separating: SHA-256 pads by message length, so
 * hashField(x) can never collide with hashField(a, b).
 */
export function hashField(...values) {
  const digest = createHash("sha256").update(Buffer.concat(values.map(toBytes32))).digest();
  return BigInt("0x" + digest.toString("hex")) >> 8n;
}
