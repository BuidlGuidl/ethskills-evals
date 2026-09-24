import { poseidon2 } from "poseidon-lite";

export const TREE_DEPTH = 8;
export const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function poseidonHash(left, right) {
  return BigInt(poseidon2([BigInt(left), BigInt(right)]));
}

export function toHex32(value) {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

export function randomField() {
  let value;
  do {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    value = BigInt(`0x${hex}`) % FIELD_SIZE;
  } while (value === 0n);
  return value;
}

export function commitment(nullifier, secret) {
  return poseidonHash(nullifier, secret);
}

export function nullifierHash(nullifier, proposalId) {
  return poseidonHash(nullifier, BigInt(proposalId));
}

export function buildZeroes(depth = TREE_DEPTH) {
  const zeroes = [0n];
  for (let i = 1; i <= depth; i += 1) {
    zeroes.push(poseidonHash(zeroes[i - 1], zeroes[i - 1]));
  }
  return zeroes;
}

export function buildTree(leaves, depth = TREE_DEPTH) {
  const zeroes = buildZeroes(depth);
  const size = 1 << depth;
  if (leaves.length > size) {
    throw new Error(`tree has ${leaves.length} leaves, max is ${size}`);
  }

  let level = Array.from({ length: size }, (_, i) => BigInt(leaves[i] ?? 0n));
  const levels = [level];
  for (let d = 0; d < depth; d += 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(poseidonHash(level[i] ?? zeroes[d], level[i + 1] ?? zeroes[d]));
    }
    level = next;
    levels.push(level);
  }
  return { root: levels[depth][0], levels, zeroes };
}

export function merkleProof(leaves, leafIndex, depth = TREE_DEPTH) {
  const tree = buildTree(leaves, depth);
  const pathElements = [];
  const pathIndices = [];
  let index = Number(leafIndex);

  for (let d = 0; d < depth; d += 1) {
    const siblingIndex = index ^ 1;
    pathElements.push(tree.levels[d][siblingIndex] ?? tree.zeroes[d]);
    pathIndices.push(Boolean(index & 1));
    index >>= 1;
  }

  return { ...tree, pathElements, pathIndices };
}
