import { poseidon2 } from "./poseidon.js";

export const TREE_DEPTH = 8;

export async function zeroes(depth = TREE_DEPTH) {
  const values = [];
  let current = 0n;
  for (let i = 0; i < depth; i += 1) {
    values.push(current);
    current = await poseidon2(current, current);
  }
  return values;
}

export async function buildTree(leaves, depth = TREE_DEPTH) {
  const capacity = 1 << depth;
  if (leaves.length > capacity) {
    throw new Error(`too many leaves for depth ${depth}`);
  }

  let level = Array.from({ length: capacity }, (_, index) => leaves[index] ?? 0n);
  const levels = [level];

  for (let d = 0; d < depth; d += 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(await poseidon2(level[i], level[i + 1]));
    }
    levels.push(next);
    level = next;
  }

  return { root: levels[depth][0], levels };
}

export async function merkleProof(leaves, leafIndex, depth = TREE_DEPTH) {
  const tree = await buildTree(leaves, depth);
  const siblings = [];
  const indices = [];
  let index = leafIndex;

  for (let d = 0; d < depth; d += 1) {
    const siblingIndex = index ^ 1;
    siblings.push(tree.levels[d][siblingIndex]);
    indices.push(index & 1);
    index >>= 1;
  }

  return { root: tree.root, siblings, indices };
}

