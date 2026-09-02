import { hashField } from "./hash.js";

/** Must match TREE_DEPTH in circuits/vote/src/main.nr and MemberRegistry.sol. */
export const TREE_DEPTH = 10;
export const MAX_MEMBERS = 1 << TREE_DEPTH;

/** zeros[i] = root of an all-zero subtree of height i. */
function zeroNodes() {
  const zeros = [0n];
  for (let i = 1; i <= TREE_DEPTH; i++) zeros.push(hashField(zeros[i - 1], zeros[i - 1]));
  return zeros;
}

/**
 * Rebuild the whole member tree from the leaf list.
 *
 * Members should always do this from the registry's own `MemberRegistered` events
 * rather than trusting `registry.root()`: recomputing it is the check that the
 * anonymity set really is every registered member and not a set someone curated.
 */
export function buildTree(leaves) {
  if (leaves.length > MAX_MEMBERS) throw new Error("more leaves than the tree can hold");
  const zeros = zeroNodes();
  const levels = [leaves.map(BigInt)];

  for (let level = 0; level < TREE_DEPTH; level++) {
    const current = levels[level];
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : zeros[level];
      next.push(hashField(left, right));
    }
    levels.push(next);
  }

  const root = levels[TREE_DEPTH].length > 0 ? levels[TREE_DEPTH][0] : zeros[TREE_DEPTH];
  return { levels, zeros, root };
}

/**
 * Authentication path for one leaf.
 * @returns siblings[] bottom-up, and pathBits[i] = true when the node is a right child.
 */
export function merkleProof(tree, leafIndex) {
  if (leafIndex < 0 || leafIndex >= tree.levels[0].length) throw new Error("leaf index out of range");
  const siblings = [];
  const pathBits = [];
  let index = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const nodes = tree.levels[level];
    siblings.push(siblingIndex < nodes.length ? nodes[siblingIndex] : tree.zeros[level]);
    pathBits.push(isRight);
    index = Math.floor(index / 2);
  }
  return { siblings, pathBits };
}

/** Recompute a root from a leaf + path; used to self-check before proving. */
export function rootFromProof(leaf, pathBits, siblings) {
  let node = BigInt(leaf);
  for (let i = 0; i < TREE_DEPTH; i++) {
    node = pathBits[i] ? hashField(siblings[i], node) : hashField(node, siblings[i]);
  }
  return node;
}
