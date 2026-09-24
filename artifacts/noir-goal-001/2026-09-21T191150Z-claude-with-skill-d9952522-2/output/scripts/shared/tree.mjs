// Offchain mirror of MemberRegistry's tree, rebuilt by replaying LeafSet events.
// Must hash exactly like the contract (PoseidonT3) and the circuit (bn254 hash_2):
// circomlib-compatible Poseidon, inputs in (left, right) order, empty leaf = 0.
import { poseidon2 } from "poseidon-lite";

export const DEPTH = 10; // circuits/vote/src/main.nr and MemberRegistry.DEPTH

export class MirrorTree {
  constructor(depth = DEPTH) {
    this.depth = depth;
    this.zeros = [0n];
    for (let i = 0; i < depth; i++) this.zeros.push(poseidon2([this.zeros[i], this.zeros[i]]));
    this.levels = Array.from({ length: depth + 1 }, () => new Map());
  }
  node(level, index) {
    return this.levels[level].get(index) ?? this.zeros[level];
  }
  get root() {
    return this.node(this.depth, 0);
  }
  set(index, leaf) {
    this.levels[0].set(index, leaf);
    let node = leaf;
    let idx = index;
    for (let level = 0; level < this.depth; level++) {
      const sib = this.node(level, idx ^ 1);
      node = idx % 2 === 0 ? poseidon2([node, sib]) : poseidon2([sib, node]);
      idx >>= 1;
      this.levels[level + 1].set(idx, node);
    }
    return node;
  }
  path(index) {
    const siblings = [];
    const indices = [];
    let idx = index;
    for (let level = 0; level < this.depth; level++) {
      siblings.push(this.node(level, idx ^ 1));
      indices.push(idx % 2 === 1); // true => current node is the right child
      idx >>= 1;
    }
    return { siblings, indices };
  }
}

/**
 * Replay the registry's LeafSet events until the tree reaches `targetRoot`
 * (a proposal's snapshot root). Every step is checked against the root the
 * contract emitted, so a hashing mismatch fails loudly here, not in the prover.
 */
export async function treeAtRoot(registry, fromBlock, targetRoot) {
  const tree = new MirrorTree();
  if (tree.root === targetRoot) return tree;
  const events = await registry.queryFilter(registry.filters.LeafSet(), fromBlock);
  for (const ev of events) {
    const { leafIndex, commitment, root } = ev.args;
    const got = tree.set(Number(leafIndex), commitment);
    if (got !== root) throw new Error(`mirror root mismatch at leaf ${leafIndex}: ${got} != ${root}`);
    if (got === targetRoot) return tree;
  }
  throw new Error("snapshot root not found in LeafSet history");
}
