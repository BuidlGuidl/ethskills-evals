import { poseidon2 } from "poseidon-lite";

export const TREE_DEPTH = 8;
export const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function poseidonHash2(left, right) {
  return poseidon2([BigInt(left), BigInt(right)]);
}

export function toHex32(value) {
  const hex = BigInt(value).toString(16).padStart(64, "0");
  return `0x${hex}`;
}

export function assertField(value, label) {
  if (BigInt(value) < 0n || BigInt(value) >= FIELD_MODULUS) {
    throw new Error(`${label} is outside the BN254 scalar field`);
  }
}

export function randomField() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let value = BigInt(`0x${Buffer.from(bytes).toString("hex")}`);
  return value % FIELD_MODULUS;
}

export function commitmentFromNote(secret, nullifier) {
  return poseidonHash2(secret, nullifier);
}

export function nullifierHashForProposal(nullifier, proposalId) {
  return poseidonHash2(nullifier, BigInt(proposalId));
}

export function zeroes(depth = TREE_DEPTH) {
  const values = [];
  let current = 0n;
  for (let i = 0; i < depth; i += 1) {
    values.push(current);
    current = poseidonHash2(current, current);
  }
  return values;
}

export function emptyRoot(depth = TREE_DEPTH) {
  let current = 0n;
  for (let i = 0; i < depth; i += 1) {
    current = poseidonHash2(current, current);
  }
  return current;
}

export function buildTree(leaves, depth = TREE_DEPTH) {
  const capacity = 1 << depth;
  if (leaves.length > capacity) {
    throw new Error(`too many leaves for depth ${depth}`);
  }

  const zs = zeroes(depth);
  let level = Array.from({ length: capacity }, (_, i) => (i < leaves.length ? BigInt(leaves[i]) : zs[0]));
  const levels = [level];

  for (let d = 0; d < depth; d += 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(poseidonHash2(level[i], level[i + 1]));
    }
    levels.push(next);
    level = next;
  }

  return { root: levels[depth][0], levels };
}

export function merkleProof(leaves, leafIndex, depth = TREE_DEPTH) {
  const tree = buildTree(leaves, depth);
  let index = leafIndex;
  const pathElements = [];
  const pathIndices = [];

  for (let level = 0; level < depth; level += 1) {
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    pathElements.push(tree.levels[level][siblingIndex]);
    pathIndices.push(isRight);
    index = Math.floor(index / 2);
  }

  return { root: tree.root, pathElements, pathIndices };
}

