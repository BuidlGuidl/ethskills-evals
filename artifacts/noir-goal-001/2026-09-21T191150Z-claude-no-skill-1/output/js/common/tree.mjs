import { hashPair } from "./crypto.mjs";

// Must match TREE_DEPTH in circuits/vote/src/main.nr and src/AnonVoting.sol.
export const TREE_DEPTH = 16;

const ZEROS = (() => {
  const z = [0n];
  for (let i = 1; i <= TREE_DEPTH; i++) z.push(hashPair(z[i - 1], z[i - 1]));
  return z;
})();

/**
 * Sparse append-only Poseidon Merkle tree identical to the one AnonVoting
 * maintains on-chain (empty leaves are 0).
 */
export class MemberTree {
  constructor(leaves) {
    this.layers = [leaves.map(BigInt)];
    for (let d = 0; d < TREE_DEPTH; d++) {
      const below = this.layers[d];
      const layer = [];
      for (let i = 0; i < below.length; i += 2) {
        layer.push(hashPair(below[i], i + 1 < below.length ? below[i + 1] : ZEROS[d]));
      }
      this.layers.push(layer);
    }
  }

  get root() {
    return this.layers[TREE_DEPTH][0] ?? ZEROS[TREE_DEPTH];
  }

  indexOf(leaf) {
    return this.layers[0].indexOf(BigInt(leaf));
  }

  /** Siblings bottom-up and direction bits (true = our node is the right child). */
  path(index) {
    if (index < 0 || index >= this.layers[0].length) throw new Error(`leaf ${index} not in tree`);
    const siblings = [];
    const indices = [];
    let i = index;
    for (let d = 0; d < TREE_DEPTH; d++) {
      const sib = i ^ 1;
      siblings.push(sib < this.layers[d].length ? this.layers[d][sib] : ZEROS[d]);
      indices.push((i & 1) === 1);
      i >>= 1;
    }
    return { siblings, indices };
  }
}
