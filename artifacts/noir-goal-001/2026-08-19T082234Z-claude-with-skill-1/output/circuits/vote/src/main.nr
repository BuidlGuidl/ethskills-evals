//! Anonymous DAO ballot circuit.
//!
//! Proves: "I am one of the members whose identity commitment sits in the
//! Merkle tree with root `root`, and I am casting `vote` on `proposal_id`" —
//! without revealing which member.
//!
//! `nullifier_hash` is bound to `proposal_id`, so one member can vote at most
//! once per proposal, and their votes on two different proposals cannot be
//! linked to each other.
//!
//! Hash is Poseidon (BN254, circomlib parameters) everywhere: here, in the
//! offchain mirror (poseidon-lite `poseidon2`) and onchain (PoseidonT3.hash).
//! See scripts/check-hash-parity.mjs.

use poseidon::poseidon::bn254::hash_2;

/// 2^8 = 256 leaves. Must match MerkleTreeLib.DEPTH and TREE_DEPTH in scripts/client/tree.mjs.
global TREE_DEPTH: u32 = 8;

fn main(
    // --- public inputs, in this order; the contract must build the same array ---
    root: pub Field,
    proposal_id: pub Field,
    nullifier_hash: pub Field,
    vote: pub Field,
    // --- private witness ---
    secret: Field,
    nullifier_secret: Field,
    path_elements: [Field; TREE_DEPTH],
    path_indices: [bool; TREE_DEPTH],
) {
    // A ballot is yes or no. Also forces `vote` into the constraint system, so
    // a relayer cannot flip it after the fact: it is bound by the proof.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    let commitment = hash_2([secret, nullifier_secret]);
    assert(merkle_root(commitment, path_elements, path_indices) == root, "not a member of root");

    // Scoped to the proposal: same member, different proposal -> unlinkable nullifier.
    assert(nullifier_hash == hash_2([nullifier_secret, proposal_id]), "bad nullifier");
}

/// path_indices[i] == true means `node` is the RIGHT child at level i,
/// i.e. bit i of the leaf index is 1.
fn merkle_root(
    leaf: Field,
    path_elements: [Field; TREE_DEPTH],
    path_indices: [bool; TREE_DEPTH],
) -> Field {
    let mut node = leaf;
    for i in 0..TREE_DEPTH {
        let sibling = path_elements[i];
        let (left, right) = if path_indices[i] { (sibling, node) } else { (node, sibling) };
        node = hash_2([left, right]);
    }
    node
}

mod tests {
    use super::{hash_2, main, merkle_root, TREE_DEPTH};

    /// zeros[0] = 0, zeros[i] = H(zeros[i-1], zeros[i-1]) — the empty-subtree
    /// hashes. Same convention as MerkleTreeLib and scripts/client/tree.mjs.
    fn zeros() -> [Field; TREE_DEPTH] {
        let mut z: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
        for i in 1..TREE_DEPTH {
            z[i] = hash_2([z[i - 1], z[i - 1]]);
        }
        z
    }

    /// Leaf 0 of an otherwise-empty tree: every sibling is the empty subtree.
    #[test]
    fn first_member_can_vote() {
        let secret = 111;
        let nullifier_secret = 222;
        let proposal_id = 7;

        let commitment = hash_2([secret, nullifier_secret]);
        let path_elements = zeros();
        let path_indices = [false; TREE_DEPTH];
        let root = merkle_root(commitment, path_elements, path_indices);

        main(
            root,
            proposal_id,
            hash_2([nullifier_secret, proposal_id]),
            1,
            secret,
            nullifier_secret,
            path_elements,
            path_indices,
        );
    }

    #[test(should_fail_with = "vote must be 0 or 1")]
    fn rejects_ballot_stuffing_via_vote_weight() {
        let secret = 111;
        let nullifier_secret = 222;
        let proposal_id = 7;
        let commitment = hash_2([secret, nullifier_secret]);
        let path_elements = zeros();
        let path_indices = [false; TREE_DEPTH];
        let root = merkle_root(commitment, path_elements, path_indices);

        main(
            root,
            proposal_id,
            hash_2([nullifier_secret, proposal_id]),
            1000, // "1000 yes votes"
            secret,
            nullifier_secret,
            path_elements,
            path_indices,
        );
    }

    #[test(should_fail_with = "not a member of root")]
    fn rejects_non_member() {
        let proposal_id = 7;
        let path_elements = zeros();
        let path_indices = [false; TREE_DEPTH];
        // root of a tree containing someone else's commitment
        let root = merkle_root(hash_2([111, 222]), path_elements, path_indices);

        main(
            root,
            proposal_id,
            hash_2([999, proposal_id]),
            1,
            333,
            999,
            path_elements,
            path_indices,
        );
    }

    #[test(should_fail_with = "bad nullifier")]
    fn rejects_nullifier_from_another_proposal() {
        let secret = 111;
        let nullifier_secret = 222;
        let commitment = hash_2([secret, nullifier_secret]);
        let path_elements = zeros();
        let path_indices = [false; TREE_DEPTH];
        let root = merkle_root(commitment, path_elements, path_indices);

        // Reusing proposal 6's nullifier to vote twice on proposal 7.
        main(
            root,
            7,
            hash_2([nullifier_secret, 6]),
            1,
            secret,
            nullifier_secret,
            path_elements,
            path_indices,
        );
    }
}
