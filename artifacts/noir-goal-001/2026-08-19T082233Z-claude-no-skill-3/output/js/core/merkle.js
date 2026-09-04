import { keccak256, toUtf8Bytes } from "ethers";
import { hashPair } from "./hash.js";

/** Must match MembershipRegistry.TREE_DEPTH and circuits/vote merkle.nr. */
export const TREE_DEPTH = 8;

/** Must match MembershipRegistry.EMPTY_LEAF. */
export const EMPTY_LEAF = BigInt(keccak256(toUtf8Bytes("dao-private-vote.empty-leaf"))) >> 8n;

/** zeros[i] = root of an all-empty subtree of height i. */
export function emptySubtreeRoots(depth = TREE_DEPTH) {
  const zeros = [];
  let node = EMPTY_LEAF;
  for (let i = 0; i < depth; i++) {
    zeros.push(node);
    node = hashPair(node, node);
  }
  return zeros;
}

/**
 * Rebuild the whole membership tree from the public leaf list, and read off
 * one member's path.
 *
 * Doing this locally, from the full `getCommitments()` list, is part of the
 * privacy story: asking a server for "my" Merkle path would tell that server
 * which leaf is yours.
 */
export function buildTree(commitments, depth = TREE_DEPTH) {
  const zeros = emptySubtreeRoots(depth);
  const levels = [commitments.map(BigInt)];

  for (let level = 0; level < depth; level++) {
    const current = levels[level];
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : zeros[level];
      next.push(hashPair(left, right));
    }
    if (next.length === 0) next.push(hashPair(zeros[level], zeros[level]));
    levels.push(next);
  }

  return {
    depth,
    zeros,
    levels,
    root: levels[depth][0],
    /** Sibling at each level, bottom-up: exactly the circuit's `siblings`. */
    proofFor(leafIndex) {
      if (leafIndex < 0 || leafIndex >= commitments.length) throw new Error(`no leaf at index ${leafIndex}`);
      const siblings = [];
      let index = leafIndex;
      for (let level = 0; level < depth; level++) {
        const siblingIndex = index ^ 1;
        const nodes = levels[level];
        siblings.push(siblingIndex < nodes.length ? nodes[siblingIndex] : zeros[level]);
        index >>= 1;
      }
      return { leafIndex, siblings };
    },
  };
}

/** Recompute a root from a leaf and its path - the circuit's check, in JS. */
export function rootFromPath(leaf, leafIndex, siblings) {
  let node = BigInt(leaf);
  let index = leafIndex;
  for (const sibling of siblings) {
    node = index & 1 ? hashPair(sibling, node) : hashPair(node, sibling);
    index >>= 1;
  }
  return node;
}

/**
 * Find the tree that produced `targetRoot`.
 *
 * A proposal is voted against the membership snapshot taken when it was
 * created, and the leaf list is append-only, so that snapshot is a prefix of
 * today's list. We walk prefixes back until the root matches.
 */
export function treeMatchingRoot(commitments, targetRoot, depth = TREE_DEPTH) {
  const target = BigInt(targetRoot);
  for (let size = commitments.length; size >= 0; size--) {
    const tree = buildTree(commitments.slice(0, size), depth);
    if (tree.root === target) return { tree, snapshotSize: size };
  }
  throw new Error("no prefix of the leaf list matches the proposal's membership root");
}
