//! Anonymous DAO ballot circuit.
//!
//! Proves: "I hold a membership commitment that was in the member tree when this
//! proposal was opened, and this is my one vote on it" — without revealing which
//! commitment.
//!
//! Every Poseidon call here is `poseidon::poseidon::bn254::hash_2`, the same
//! function as `PoseidonT3.hash` in Solidity and `circomlibjs.poseidon` in the
//! client mirror. Leaf order is (left, right); see client/src/tree.js and
//! contracts/src/MemberRegistry.sol.

use poseidon::poseidon::bn254::hash_2;

global TREE_DEPTH: u32 = 10; // 1024 member slots

fn main(
    // --- public ---
    // Member tree root snapshotted when the proposal was opened.
    root: pub Field,
    // Scopes the nullifier so one member's votes do not link across proposals.
    proposal_id: pub Field,
    // Spent marker for (this member, this proposal). Unlinkable to the commitment.
    nullifier_hash: pub Field,
    // 0 = no, 1 = yes. Public so the contract can tally it, and bound to this
    // proof so a relayer cannot flip it in transit.
    vote: pub Field,
    // --- private ---
    identity_secret: Field,
    identity_trapdoor: Field,
    // path_indices[i] == true  =>  the running node is the RIGHT child at level i
    path_indices: [bool; TREE_DEPTH],
    siblings: [Field; TREE_DEPTH],
) {
    // A vote is a bit. This also keeps `vote` a live public input.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    let commitment = hash_2([identity_secret, identity_trapdoor]);

    let mut node = commitment;
    for i in 0..TREE_DEPTH {
        let sibling = siblings[i];
        let left = if path_indices[i] { sibling } else { node };
        let right = if path_indices[i] { node } else { sibling };
        node = hash_2([left, right]);
    }
    assert(node == root, "commitment is not in the member tree");

    // Deterministic in (identity_secret, proposal_id): one vote per member per
    // proposal, and no linkage between the same member's votes on two proposals.
    assert(nullifier_hash == hash_2([identity_secret, proposal_id]), "bad nullifier");
}

#[test]
fn vote_with_a_two_member_tree() {
    // Member A at leaf 0, member B at leaf 1, all other slots zero.
    let secret = 111;
    let trapdoor = 222;
    let commitment = hash_2([secret, trapdoor]);
    let other = hash_2([333, 444]);

    // zeros[i] for an empty fixed-depth tree seeded with leaf value 0
    let mut zeros: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    for i in 1..TREE_DEPTH {
        zeros[i] = hash_2([zeros[i - 1], zeros[i - 1]]);
    }

    let mut siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    siblings[0] = other;
    for i in 1..TREE_DEPTH {
        siblings[i] = zeros[i];
    }
    let path_indices: [bool; TREE_DEPTH] = [false; TREE_DEPTH];

    let mut node = commitment;
    for i in 0..TREE_DEPTH {
        node = hash_2([node, siblings[i]]);
    }

    let proposal_id = 7;
    main(
        node,
        proposal_id,
        hash_2([secret, proposal_id]),
        1,
        secret,
        trapdoor,
        path_indices,
        siblings,
    );
}

/// Shared hash vectors. The same four values are pinned in
/// contracts/test/PoseidonParity.t.sol and client/src/poseidon.js. If Poseidon is ever
/// swapped for Poseidon2, or the input order changes on one layer only, this fails
/// instead of producing a tree the other layers silently disagree with.
#[test]
fn poseidon_vectors() {
    assert_eq(hash_2([1, 2]), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
    assert_eq(hash_2([0, 0]), 0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864);
    assert_eq(
        hash_2([111, 222]),
        0x2d888d8cb35bbb41d435db55d46e55a6996049e2b4a44ce1483101b572c6bd83,
    );

    let mut node = 0;
    for _ in 0..TREE_DEPTH {
        node = hash_2([node, node]);
    }
    assert_eq(node, 0x1b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af2);
}

/// A vote must be a bit -- 2 is not "yes, emphatically".
#[test(should_fail_with = "vote must be 0 or 1")]
fn rejects_non_binary_vote() {
    main(0, 0, 0, 2, 0, 0, [false; TREE_DEPTH], [0; TREE_DEPTH]);
}
