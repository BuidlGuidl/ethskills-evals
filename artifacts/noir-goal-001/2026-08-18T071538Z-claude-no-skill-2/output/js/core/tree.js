// The membership Merkle tree, mirroring circuits/common/src/lib.nr.
import { poseidon2 } from "./poseidon.js";

export const TREE_DEPTH = 8;
export const TREE_CAPACITY = 1 << TREE_DEPTH; // 256 leaves, DAO has 150 members

/** Root of an empty subtree at each level; ZEROS[TREE_DEPTH] is the empty root. */
export const ZEROS = (() => {
  const zeros = [0n];
  for (let d = 0; d < TREE_DEPTH; d++) zeros.push(poseidon2([zeros[d], zeros[d]]));
  return zeros;
})();

export const EMPTY_ROOT = ZEROS[TREE_DEPTH];

/**
 * Build the whole tree over `leaves` (bigints, in registry leaf order).
 * 255 hashes for a full tree — cheap enough to redo on every call, which keeps
 * the caller from having to cache anything.
 */
export function buildTree(leaves) {
  if (leaves.length > TREE_CAPACITY) throw new Error(`more than ${TREE_CAPACITY} leaves`);

  const levels = [Array.from({ length: TREE_CAPACITY }, (_, i) => (i < leaves.length ? BigInt(leaves[i]) : 0n))];
  while (levels[levels.length - 1].length > 1) {
    const below = levels[levels.length - 1];
    const above = [];
    for (let i = 0; i < below.length; i += 2) above.push(poseidon2([below[i], below[i + 1]]));
    levels.push(above);
  }

  return {
    root: levels[TREE_DEPTH][0],
    /** The TREE_DEPTH sibling hashes on the path from `index` to the root. */
    siblings(index) {
      if (index < 0 || index >= TREE_CAPACITY) throw new Error(`leaf index ${index} out of range`);
      return levels.slice(0, TREE_DEPTH).map((level, d) => level[(index >> d) ^ 1]);
    },
  };
}

/** Root the tree would have after appending `leaf` at the next free slot. */
export function rootAfterAppend(leaves, leaf) {
  return buildTree([...leaves, BigInt(leaf)]).root;
}
