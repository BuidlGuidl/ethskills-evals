// Anonymous yes/no vote.
//
// Proves, without revealing which member is voting:
//   1. the prover knows `secret` such that commitment = H1(secret) is a leaf of the
//      voter-registry Merkle tree whose root is `root` (the proposal's snapshot root);
//   2. `nullifier` = H2(secret, scope), so one secret can yield exactly one nullifier
//      per proposal (the contract rejects a nullifier it has already seen);
//   3. `vote` is 0 (no) or 1 (yes).
//
// `scope` is derived onchain from (chainid, voting contract, proposalId), so nullifiers
// from different proposals / deployments cannot be linked to each other.
//
// All hashes are circomlib-compatible Poseidon over BN254, matching PoseidonT3 in the
// Solidity registry and poseidon-lite in the Node scripts.

use poseidon::poseidon::bn254::{hash_1, hash_2};

global TREE_DEPTH: u32 = 10; // 1024 members; must match VoterRegistry.DEPTH

fn main(
    // --- private ---
    secret: Field,
    leaf_index: Field,
    siblings: [Field; TREE_DEPTH],
    // --- public (order = order of public inputs the verifier expects) ---
    root: pub Field,
    scope: pub Field,
    vote: pub Field,
    nullifier: pub Field,
) {
    // Vote is a single bit.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    // Membership: recompute the root from the leaf.
    let commitment = hash_1([secret]);
    let index_bits: [bool; TREE_DEPTH] = leaf_index.to_le_bits();
    let mut node = commitment;
    for i in 0..TREE_DEPTH {
        node = if !index_bits[i] {
            hash_2([node, siblings[i]])
        } else {
            hash_2([siblings[i], node])
        };
    }
    assert(node == root, "not a member of this snapshot");

    // One vote per member per proposal.
    assert(nullifier == hash_2([secret, scope]), "bad nullifier");
}

// ------------------------------------------------------------------ tests

#[test]
fn test_vote_single_member() {
    let secret = 12345;
    let scope = 777;
    let mut siblings = [0; TREE_DEPTH];
    // Build zero-subtree siblings like the empty onchain tree.
    let mut z = 0;
    for i in 0..TREE_DEPTH {
        siblings[i] = z;
        z = hash_2([z, z]);
    }
    let mut node = hash_1([secret]);
    for i in 0..TREE_DEPTH {
        node = hash_2([node, siblings[i]]);
    }
    main(secret, 0, siblings, node, scope, 1, hash_2([secret, scope]));
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn test_rejects_non_binary_vote() {
    main(1, 0, [0; TREE_DEPTH], 0, 0, 2, 0);
}

#[test(should_fail_with = "not a member of this snapshot")]
fn test_rejects_wrong_root() {
    main(1, 0, [0; TREE_DEPTH], 42, 0, 1, 0);
}
