// Member-side cryptography: secret -> commitment -> Merkle proof -> nullifier.
//
// Every hash here mirrors `contracts/src/Hashes.sol` and
// `circuits/vote/src/main.nr`. All three must agree exactly, or a proof built
// here will not verify against a root built on-chain.

import { keccak256, solidityPacked, toBeHex } from "ethers";

/** Merkle depth; 2**8 = 256 leaves. Must equal DEPTH in the circuit + registry. */
export const DEPTH = 8;
export const CAPACITY = 1 << DEPTH;

/** Domain tags. Must equal TAG_COMMITMENT / TAG_NULLIFIER in the circuit. */
export const TAG_COMMITMENT = 1n;
export const TAG_NULLIFIER = 2n;

/** Message the member signs to derive their voting secret. */
export const SECRET_DERIVATION_MESSAGE =
  "DAO private ballot :: voting key v1\n" +
  "Signing this derives your anonymous voting secret.\n" +
  "Never share this signature. Anyone holding it can vote as you.";

/** keccak256 truncated to its top 248 bits, i.e. solidity `>> 8`. */
function truncated(hexDigest) {
  return BigInt(hexDigest) >> 8n;
}

/** Merkle node hash of an ordered pair. Mirrors Hashes.hashPair. */
export function hashPair(left, right) {
  return truncated(
    keccak256(solidityPacked(["bytes32", "bytes32"], [toBeHex(left, 32), toBeHex(right, 32)])),
  );
}

/** Domain-separated 2-operand hash. Mirrors Hashes.tagged / tagged_hash. */
export function taggedHash(tag, a, b) {
  return truncated(
    keccak256(
      solidityPacked(
        ["bytes32", "bytes32", "bytes32"],
        [toBeHex(tag, 32), toBeHex(a, 32), toBeHex(b, 32)],
      ),
    ),
  );
}

/** The public leaf a member registers on-chain. */
export function commitmentFromSecret(secret) {
  return taggedHash(TAG_COMMITMENT, secret, 0n);
}

/** The spend-once tag a member reveals when voting on a given proposal. */
export function nullifierFor(secret, proposalId) {
  return taggedHash(TAG_NULLIFIER, secret, BigInt(proposalId));
}

/**
 * Derive the voting secret from the member's wallet signature.
 *
 * Deterministic (ethers uses RFC-6979), so the member can always regenerate it
 * and never has to store an extra secret. The signature is produced offline and
 * never touches the chain.
 */
export async function deriveSecret(signer) {
  const signature = await signer.signMessage(SECRET_DERIVATION_MESSAGE);
  return truncated(keccak256(signature));
}

/** zeros[i] = root of an empty subtree of height i. Mirrors MemberRegistry. */
export function emptySubtreeRoots(depth = DEPTH) {
  const zeros = [0n];
  for (let i = 1; i <= depth; i++) zeros.push(hashPair(zeros[i - 1], zeros[i - 1]));
  return zeros;
}

/**
 * Rebuild the whole member tree from the public commitment list.
 *
 * Anyone can call this against on-chain data and confirm the registry's root,
 * which is what stops the DAO from quietly swapping in a tree that would shrink
 * a voter's anonymity set.
 */
export function buildTree(commitments, depth = DEPTH) {
  if (commitments.length === 0) throw new Error("cannot build a tree with no members");
  if (commitments.length > 1 << depth) throw new Error("more commitments than tree capacity");

  const zeros = emptySubtreeRoots(depth);
  const layers = [commitments.map(BigInt)];

  for (let d = 0; d < depth; d++) {
    const level = layers[d];
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : zeros[d];
      next.push(hashPair(left, right));
    }
    layers.push(next);
  }

  return { layers, root: layers[depth][0], zeros, depth };
}

/**
 * Sibling hashes from a leaf up to the root.
 *
 * `path[d]` is the sibling at level d; bit d of leafIndex says whether our node
 * is the right child there. The circuit consumes exactly this shape.
 */
export function merkleProof(tree, leafIndex) {
  if (leafIndex < 0 || leafIndex >= tree.layers[0].length) {
    throw new Error(`leaf index ${leafIndex} is outside the tree`);
  }
  const path = [];
  let index = leafIndex;
  for (let d = 0; d < tree.depth; d++) {
    const level = tree.layers[d];
    const siblingIndex = index ^ 1;
    path.push(siblingIndex < level.length ? level[siblingIndex] : tree.zeros[d]);
    index >>= 1;
  }
  return { path, leafIndex };
}

/** Recompute a root from a leaf + path, the same way the circuit does. */
export function rootFromProof(leaf, path, leafIndex) {
  let node = BigInt(leaf);
  for (let d = 0; d < path.length; d++) {
    const isRightChild = (leafIndex >> d) & 1;
    node = isRightChild ? hashPair(path[d], node) : hashPair(node, path[d]);
  }
  return node;
}
