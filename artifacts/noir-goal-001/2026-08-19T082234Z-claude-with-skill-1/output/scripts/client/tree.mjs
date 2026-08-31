import { hash2 } from "./poseidon.mjs";

/// Must equal MemberRegistry.DEPTH and TREE_DEPTH in circuits/vote/src/main.nr.
export const TREE_DEPTH = 8;

/// An offchain mirror of MemberRegistry's incremental Merkle tree.
///
/// Clients rebuild this by replaying `MemberJoined` logs — the contract has no
/// "give me my Merkle path" call, and it could not have one: the path is a
/// function of every other member's commitment, and asking a server for it
/// would tell that server which leaf you are about to vote from.
///
/// Empty positions hash as zeros[i], with zeros[0] = 0 and
/// zeros[i] = H(zeros[i-1], zeros[i-1]) — same convention as the constructor
/// loop in MemberRegistry.sol and the `zeros()` helper in the circuit's tests.
export class MerkleTree {
  constructor(depth = TREE_DEPTH) {
    this.depth = depth;
    this.zeros = [];
    let z = 0n;
    for (let i = 0; i < depth; i++) {
      this.zeros.push(z);
      z = hash2(z, z);
    }
    this.emptyRoot = z;
    this.leaves = [];
  }

  insert(leaf) {
    this.leaves.push(BigInt(leaf));
    return this.leaves.length - 1;
  }

  indexOf(leaf) {
    return this.leaves.findIndex((l) => l === BigInt(leaf));
  }

  /// One level up, padding a missing right sibling with the empty-subtree hash.
  #up(level, height) {
    const next = [];
    for (let j = 0; j < level.length; j += 2) {
      const left = level[j];
      const right = j + 1 < level.length ? level[j + 1] : this.zeros[height];
      next.push(hash2(left, right));
    }
    return next;
  }

  get root() {
    let level = this.leaves.slice();
    for (let i = 0; i < this.depth; i++) level = this.#up(level, i);
    return level.length ? level[0] : this.emptyRoot;
  }

  /// Merkle witness for `index`, shaped exactly as the circuit expects:
  /// `pathElements: [Field; DEPTH]` and `pathIndices: [bool; DEPTH]` where
  /// true means "my node is the RIGHT child at this level".
  proof(index) {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`leaf index ${index} is not in the tree (${this.leaves.length} leaves)`);
    }
    const pathElements = [];
    const pathIndices = [];
    let level = this.leaves.slice();
    let idx = index;
    for (let i = 0; i < this.depth; i++) {
      const siblingIdx = idx ^ 1;
      pathElements.push(siblingIdx < level.length ? level[siblingIdx] : this.zeros[i]);
      pathIndices.push((idx & 1) === 1);
      idx >>= 1;
      level = this.#up(level, i);
    }
    return { pathElements, pathIndices };
  }
}

/// Replay MemberJoined logs into a fresh mirror.
/// `upToLeaves` truncates to the state a proposal snapshotted, so a member who
/// joined after the snapshot is correctly excluded rather than silently
/// producing a proof against the wrong root.
export function treeFromJoinEvents(events, upToLeaves = Infinity) {
  const ordered = [...events].sort((a, b) => Number(a.leafIndex - b.leafIndex));
  const tree = new MerkleTree();
  for (const e of ordered) {
    if (Number(e.leafIndex) >= upToLeaves) break;
    if (Number(e.leafIndex) !== tree.leaves.length) {
      throw new Error(`gap in MemberJoined logs: expected leaf ${tree.leaves.length}, got ${e.leafIndex}`);
    }
    tree.insert(e.commitment);
  }
  return tree;
}
