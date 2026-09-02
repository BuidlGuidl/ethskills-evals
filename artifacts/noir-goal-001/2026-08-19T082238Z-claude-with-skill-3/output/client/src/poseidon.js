// The one Poseidon used everywhere in this project.
//
// circomlibjs' `poseidon` is BN254 Poseidon with circomlib parameters -- the same
// function as `poseidon::poseidon::bn254::hash_2` in circuits/vote and
// `PoseidonT3Hasher.hash` in contracts. Poseidon2 is a DIFFERENT function; swapping it
// in on any one layer produces a tree the other two cannot agree with.
//
// The vectors below are the same ones pinned in circuits/vote/src/main.nr
// (`poseidon_vectors`) and contracts/test/PoseidonParity.t.sol. They are checked on
// first use, so a bad dependency bump fails loudly here rather than as an
// unprovable Merkle path later.

import { buildPoseidon } from "circomlibjs";

export const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const VECTORS = [
  [1n, 2n, 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189an],
  [0n, 0n, 0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864n],
  [111n, 222n, 0x2d888d8cb35bbb41d435db55d46e55a6996049e2b4a44ce1483101b572c6bd83n],
];

let poseidonPromise;

/** @returns {Promise<(a: bigint, b: bigint) => bigint>} */
export async function getPoseidon2() {
  if (!poseidonPromise) {
    poseidonPromise = (async () => {
      const p = await buildPoseidon();
      const hash2 = (a, b) => p.F.toObject(p([a, b]));
      for (const [a, b, expected] of VECTORS) {
        const got = hash2(a, b);
        if (got !== expected) {
          throw new Error(
            `Poseidon mismatch: H(${a}, ${b}) = 0x${got.toString(16)}, ` +
              `expected 0x${expected.toString(16)}. The JS hash no longer matches the ` +
              `circuit and the contracts.`,
          );
        }
      }
      return hash2;
    })();
  }
  return poseidonPromise;
}
