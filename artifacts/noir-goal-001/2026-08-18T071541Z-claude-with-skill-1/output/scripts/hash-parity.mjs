/**
 * The offchain leg of the three-way Poseidon parity check.
 *
 * The circuit hashes with `poseidon::poseidon::bn254::hash_2`, this client hashes with
 * `poseidon-lite`'s `poseidon2`, and the registry contract hashes with `PoseidonT3.hash`. If any
 * one of them drifts, proofs simply stop verifying with no useful error, so the same vector is
 * pinned in all three: here, in `test_poseidon_parity_with_js` (circuits/anon_vote/src/main.nr),
 * and in `HashParityTest` (contracts/test/HashParity.t.sol).
 *
 *   npm run parity
 */
import { poseidon2 } from "poseidon-lite";
import { toHex32 } from "./lib/field.mjs";

const EXPECTED = 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189an;
const actual = poseidon2([1n, 2n]);

console.log(`poseidon2([1, 2]) = ${toHex32(actual)}`);
if (actual !== EXPECTED) {
  console.error(`MISMATCH — expected ${toHex32(EXPECTED)}`);
  process.exit(1);
}
console.log("matches the vector pinned in the circuit and in PoseidonT3");
