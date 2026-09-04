import { poseidon2 } from "poseidon-lite";

/// BN254 scalar field.
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/// The one hash function this whole system uses: Poseidon over BN254 with
/// circomlib parameters.
///   - in the circuit: `poseidon::poseidon::bn254::hash_2`
///   - onchain:        `PoseidonT3.hash`
///   - here:           `poseidon-lite`'s `poseidon2`
/// scripts/check-hash-parity.mjs pins all three to the same test vectors.
export function hash2(a, b) {
  return poseidon2([BigInt(a), BigInt(b)]);
}

export function toHex32(x) {
  return "0x" + BigInt(x).toString(16).padStart(64, "0");
}
