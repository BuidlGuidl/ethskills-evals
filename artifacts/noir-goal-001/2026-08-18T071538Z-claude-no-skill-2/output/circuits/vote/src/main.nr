//! Voting circuit: "I know the secret behind some leaf of the tree `root`,
//! this is my one-per-proposal nullifier, and this is my ballot."
//!
//! `index` and `siblings` stay private, so the proof says nothing about *which*
//! member is voting. `vote` is public because the contract has to add it to a
//! tally — but it is bound into the proof, so a relayer carrying the proof to
//! chain cannot flip it.

use common::{commitment, compute_root, nullifier, TREE_DEPTH};

fn main(
    // --- public: everything the contract checks against its own state ---
    root: pub Field,
    proposal_context: pub Field,
    vote: pub Field,
    nullifier_hash: pub Field,
    // --- private: the member's identity and their place in the tree ---
    secret: Field,
    index: u32,
    siblings: [Field; TREE_DEPTH],
) {
    // Ballots are yes/no only; an out-of-range value would corrupt the tally.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    // Membership: our commitment sits somewhere in the snapshot tree.
    let leaf = commitment(secret);
    assert(compute_root(leaf, index, siblings) == root, "not a registered member");

    // One ballot per member per proposal.
    assert(nullifier(secret, proposal_context) == nullifier_hash, "nullifier mismatch");
}

#[test]
fn accepts_a_member_of_a_two_leaf_tree() {
    let secret = 987654321;
    let other = common::commitment(111);
    let leaf = commitment(secret);

    // Leaf 1 of an otherwise-empty depth-8 tree; sibling 0 is the other member.
    let mut siblings = [0; TREE_DEPTH];
    siblings[0] = other;
    let root = compute_root(leaf, 1, siblings);

    main(root, 7, 1, nullifier(secret, 7), secret, 1, siblings);
}

#[test(should_fail_with = "not a registered member")]
fn rejects_a_non_member() {
    let siblings = [0; TREE_DEPTH];
    let root = compute_root(commitment(1), 0, siblings);
    main(root, 7, 1, nullifier(2, 7), 2, 0, siblings);
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn rejects_a_ballot_that_is_not_yes_or_no() {
    let siblings = [0; TREE_DEPTH];
    let root = compute_root(commitment(1), 0, siblings);
    main(root, 7, 5, nullifier(1, 7), 1, 0, siblings);
}
