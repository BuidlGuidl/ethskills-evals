// Reading the member set from chain and turning it into a Merkle proof.

import { buildTree, merkleProof, commitmentFromSecret } from "./crypto.mjs";

/**
 * Rebuild the member tree from public on-chain data and check it against the
 * root the registry reports.
 *
 * This check is the reason the DAO cannot shrink anyone's anonymity set: the
 * tree is a pure function of the commitments the registry emitted, and every
 * member recomputes it themselves before trusting a root.
 */
export async function loadMemberTree(registry) {
  const commitments = (await registry.allCommitments()).map((c) => BigInt(c));
  if (commitments.length === 0) throw new Error("no members have registered yet");

  const tree = buildTree(commitments);
  const onchainRoot = BigInt(await registry.root());
  if (tree.root !== onchainRoot) {
    throw new Error(
      `rebuilt root does not match the registry.\n` +
        `  on-chain: 0x${onchainRoot.toString(16)}\n` +
        `  rebuilt : 0x${tree.root.toString(16)}\n` +
        `Do not vote against this root.`,
    );
  }
  return { tree, commitments };
}

/** Locate the caller's own leaf without telling anyone which one it is. */
export function findLeafIndex(commitments, secret) {
  const commitment = commitmentFromSecret(secret);
  const index = commitments.findIndex((c) => c === commitment);
  if (index === -1) {
    throw new Error(
      "this secret's commitment is not in the registry -- has this member registered yet?",
    );
  }
  return { index, commitment };
}

/** Everything the circuit needs to prove membership. */
export function membershipWitness(tree, commitments, secret) {
  const { index, commitment } = findLeafIndex(commitments, secret);
  const { path } = merkleProof(tree, index);
  return { leafIndex: index, commitment, path, root: tree.root };
}
