// Poseidon2 over BN254, byte-for-byte the hash the Noir circuits use.
// Cross-checked against Noir in circuits/common (see the `empty_root_...` test)
// and by scripts/check-poseidon.mjs.
import { poseidon2Hash } from "@zkpassport/poseidon2";

export const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Poseidon2 sponge hash of 1..n field elements. */
export const poseidon2 = (inputs) => poseidon2Hash(inputs.map(BigInt));

/** 0x-prefixed 32-byte hex, the form the contracts and Prover.toml want. */
export const hex32 = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");

export function assertField(v, what) {
  const n = BigInt(v);
  if (n < 0n || n >= FIELD_MODULUS) throw new Error(`${what} is not a BN254 field element: ${v}`);
  return n;
}
