// Offchain mirror of MemberRegistry's tree.
//
// The contract never hands out a Merkle path -- asking it for one would tell the node
// you query which leaf is yours. Instead the client replays `MemberRegistered` events
// into this mirror and derives its own path locally.
//
// Must match contracts/src/MemberRegistry.sol and circuits/vote/src/main.nr exactly:
// fixed depth 10, empty leaves valued 0, parent = Poseidon(left, right).

import { getPoseidon2 } from "./poseidon.js";

export const TREE_DEPTH = 10;

export class MemberTree {
  #hash2;
  #zeros; // zeros[i] = root of an all-empty subtree of height i
  #leaves = [];

  constructor(hash2, depth = TREE_DEPTH) {
    this.depth = depth;
    this.#hash2 = hash2;
    this.#zeros = [0n];
    for (let i = 1; i <= depth; i++) {
      this.#zeros.push(hash2(this.#zeros[i - 1], this.#zeros[i - 1]));
    }
  }

  static async create(depth = TREE_DEPTH) {
    return new MemberTree(await getPoseidon2(), depth);
  }

  get size() {
    return this.#leaves.length;
  }

  insert(commitment) {
    if (this.#leaves.length >= 2 ** this.depth) throw new Error("tree full");
    this.#leaves.push(BigInt(commitment));
    return this.#leaves.length - 1;
  }

  indexOf(commitment) {
    return this.#leaves.indexOf(BigInt(commitment));
  }

  /** Level `d` of the tree, padded out with the empty-subtree value for that level. */
  #layer(d) {
    let layer = this.#leaves.slice();
    for (let level = 0; level < d; level++) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = i + 1 < layer.length ? layer[i + 1] : this.#zeros[level];
        next.push(this.#hash2(left, right));
      }
      layer = next;
    }
    return layer;
  }

  get root() {
    const top = this.#layer(this.depth);
    return top.length ? top[0] : this.#zeros[this.depth];
  }

  /**
   * Merkle witness for `leafIndex`.
   * `pathIndices[i] === true` means the running node is the RIGHT child at level i,
   * which is the convention circuits/vote/src/main.nr walks.
   */
  proof(leafIndex) {
    if (leafIndex < 0 || leafIndex >= this.#leaves.length) {
      throw new Error(`leaf ${leafIndex} is not in this tree`);
    }
    const siblings = [];
    const pathIndices = [];
    let index = leafIndex;
    for (let level = 0; level < this.depth; level++) {
      const layer = this.#layer(level);
      const siblingIndex = index ^ 1;
      siblings.push(siblingIndex < layer.length ? layer[siblingIndex] : this.#zeros[level]);
      pathIndices.push((index & 1) === 1);
      index >>= 1;
    }
    return { siblings, pathIndices, leaf: this.#leaves[leafIndex] };
  }
}

/**
 * Rebuild the tree as it stood at a proposal's snapshot.
 *
 * `events` are MemberRegistered logs; `upTo` is the proposal's snapshotMemberCount.
 * Replaying only the first `upTo` leaves is what makes the locally computed root equal
 * the root the proposal froze -- later registrations belong to a different tree.
 */
export async function treeFromEvents(events, upTo = Infinity) {
  const tree = await MemberTree.create();
  const ordered = [...events].sort((a, b) => Number(a.leafIndex) - Number(b.leafIndex));
  for (const e of ordered) {
    if (Number(e.leafIndex) >= upTo) break;
    if (Number(e.leafIndex) !== tree.size) {
      throw new Error(`gap in MemberRegistered events at leaf ${tree.size}`);
    }
    tree.insert(e.commitment);
  }
  return tree;
}
