//! `vote` — cast one ballot as an unnamed member of the snapshot tree.
//!
//! Proves three things and reveals nothing else:
//!   1. the prover knows the secret behind *some* leaf of the tree `root`,
//!   2. `nullifier` is the deterministic tag of that secret for this
//!      proposal, so a second ballot from the same member collides,
//!   3. the ballot direction `vote` is a bit, and it is bound into the proof
//!      so a relayer forwarding the transaction cannot flip it.
//!
//! `root`, `external_nullifier` and `vote` are supplied by the contract from
//! its own state and calldata, so the proof cannot be pointed at a tree, a
//! proposal or a direction other than the one being recorded.

use dao_zk::{identity_commitment, merkle_root_from_path, TREE_DEPTH, vote_nullifier};

fn main(
    // Public: checked by the contract against its own state.
    root: pub Field,
    external_nullifier: pub Field,
    nullifier: pub Field,
    vote: pub Field,
    // Private: never leaves the member's machine.
    secret: Field,
    leaf_index: Field,
    siblings: [Field; TREE_DEPTH],
) {
    assert((vote == 0) | (vote == 1), "vote must be 0 (no) or 1 (yes)");

    let commitment = identity_commitment(secret);
    assert_eq(
        merkle_root_from_path(commitment, leaf_index, siblings),
        root,
        "commitment is not in the membership tree",
    );

    assert_eq(
        vote_nullifier(secret, external_nullifier),
        nullifier,
        "nullifier does not match secret and proposal",
    );
}

mod tests {
    use dao_zk::{
        EMPTY_LEAF, hash_node, identity_commitment, merkle_root_from_path, TREE_DEPTH, vote_nullifier,
    };

    global SECRET: Field = 0xfeed;
    global PROPOSAL: Field = 0xabc;

    /// A tree holding just this member, at leaf 0.
    fn lone_member_tree() -> ([Field; TREE_DEPTH], Field) {
        let mut siblings: [Field; TREE_DEPTH] = [EMPTY_LEAF; TREE_DEPTH];
        for level in 1..TREE_DEPTH {
            siblings[level] = hash_node(siblings[level - 1], siblings[level - 1]);
        }
        let root = merkle_root_from_path(identity_commitment(SECRET), 0, siblings);
        (siblings, root)
    }

    #[test]
    fn accepts_a_member_voting_yes() {
        let (siblings, root) = lone_member_tree();
        super::main(root, PROPOSAL, vote_nullifier(SECRET, PROPOSAL), 1, SECRET, 0, siblings);
    }

    #[test]
    fn accepts_a_member_voting_no() {
        let (siblings, root) = lone_member_tree();
        super::main(root, PROPOSAL, vote_nullifier(SECRET, PROPOSAL), 0, SECRET, 0, siblings);
    }

    #[test(should_fail_with = "commitment is not in the membership tree")]
    fn rejects_a_non_member() {
        let (siblings, root) = lone_member_tree();
        let impostor = 0xdead;
        super::main(root, PROPOSAL, vote_nullifier(impostor, PROPOSAL), 1, impostor, 0, siblings);
    }

    /// Without this the member could cast unlimited ballots by varying the tag.
    #[test(should_fail_with = "nullifier does not match secret and proposal")]
    fn rejects_a_nullifier_the_member_made_up() {
        let (siblings, root) = lone_member_tree();
        super::main(root, PROPOSAL, 0x999, 1, SECRET, 0, siblings);
    }

    /// The nullifier for one proposal is not valid for another, so a ballot
    /// cannot be replayed across proposals.
    #[test(should_fail_with = "nullifier does not match secret and proposal")]
    fn rejects_a_nullifier_from_another_proposal() {
        let (siblings, root) = lone_member_tree();
        super::main(root, PROPOSAL, vote_nullifier(SECRET, 0xdef), 1, SECRET, 0, siblings);
    }

    #[test(should_fail_with = "vote must be 0 (no) or 1 (yes)")]
    fn rejects_a_vote_that_is_not_a_bit() {
        let (siblings, root) = lone_member_tree();
        super::main(root, PROPOSAL, vote_nullifier(SECRET, PROPOSAL), 7, SECRET, 0, siblings);
    }
}
