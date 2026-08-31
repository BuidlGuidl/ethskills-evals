//! One anonymous ballot for one proposal.
//!
//! Proves, without revealing which member is speaking:
//!   1. "I know the secret behind one of the commitments enrolled in the
//!       member tree whose root is `root`"          -> only members can vote
//!   2. "`nullifier` is the deterministic tag of that secret for
//!       `proposal_tag`"                             -> at most one vote each,
//!                                                      per proposal, and the
//!                                                      tag is unlinkable
//!                                                      across proposals
//!   3. "`vote` is 0 or 1"                          -> no ballot stuffing
//!
//! `vote` is public and bound into the proof: the ballot cannot be flipped in
//! flight by whoever relays it, but the tally can still be read by anyone.
//! What stays secret is *whose* ballot it is.
//!
//! `proposal_tag` is not the raw proposal number -- PrivateBallot passes
//! keccak248(ballotContract ++ proposalId), so a proof is worthless against any
//! other deployment and nullifiers from two deployments never collide.

mod hash;

use hash::{hash2, hash3};

/// 2^10 = 1024 member slots. 150 members today, room to grow.
/// Changing this means recompiling the circuit and redeploying the verifier,
/// and MemberSet.TREE_DEPTH must be changed to match.
global TREE_DEPTH: u32 = 10;

/// keccak256("dao.private-ballot.v1.commitment") & (2^248 - 1)
global TAG_COMMITMENT: Field = 0x0034ecca8b4f6d9dafdf3ced9eebc753ee17df9b6c7fc62c869ebd579303eb36;

/// keccak256("dao.private-ballot.v1.nullifier") & (2^248 - 1)
global TAG_NULLIFIER: Field = 0x00e33d762b98f0a02efaae6d0fb2a7b484b96dbaab3c09061884c16e3088d6f9;

/// The leaf a member publishes when they join the vote.
/// Public knowledge; reveals nothing without `secret`.
pub fn commitment_of(secret: Field) -> Field {
    hash2(secret, TAG_COMMITMENT)
}

/// The double-spend tag. Deterministic in (secret, proposal), so a member can
/// only vote once on a proposal -- and independent-looking across proposals,
/// so two ballots by the same member cannot be linked to each other.
pub fn nullifier_of(secret: Field, proposal_tag: Field) -> Field {
    hash3(secret, proposal_tag, TAG_NULLIFIER)
}

/// Walk a Merkle path. `path_bits[i]` is bit i of the leaf index:
/// 0 = we are the left child at that level, 1 = we are the right child.
fn merkle_root(leaf: Field, path: [Field; TREE_DEPTH], path_bits: [bool; TREE_DEPTH]) -> Field {
    let mut node = leaf;
    for i in 0..TREE_DEPTH {
        let sibling = path[i];
        let left = if path_bits[i] { sibling } else { node };
        let right = if path_bits[i] { node } else { sibling };
        node = hash2(left, right);
    }
    node
}

fn main(
    // --- public: everything the contract checks the proof against ---
    root: pub Field,
    proposal_tag: pub Field,
    nullifier: pub Field,
    vote: pub Field,
    // --- private: never leaves the member's machine ---
    secret: Field,
    path: [Field; TREE_DEPTH],
    path_bits: [bool; TREE_DEPTH],
) {
    // A ballot is yes(1) or no(0). Nothing else can be added to the tally.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    // Membership, without saying which member.
    let leaf = commitment_of(secret);
    assert(merkle_root(leaf, path, path_bits) == root, "commitment not in member tree");

    // The nullifier really is this secret's tag for this proposal, so it is
    // useless as a link back to the member but perfect as a one-vote lock.
    assert(nullifier == nullifier_of(secret, proposal_tag), "nullifier does not match secret");
}

#[test]
fn accepts_a_member_in_a_two_leaf_tree() {
    let secret = 0x1234567890abcdef;
    let leaf = commitment_of(secret);
    let sibling = 0x9999;

    // leaf sits at index 1 (right child) of an otherwise-empty depth-10 tree
    let mut path = [0; TREE_DEPTH];
    path[0] = sibling;
    let mut bits = [false; TREE_DEPTH];
    bits[0] = true;

    let mut node = hash2(sibling, leaf);
    for _ in 1..TREE_DEPTH {
        node = hash2(node, 0);
    }

    main(node, 7, nullifier_of(secret, 7), 1, secret, path, bits);
}

#[test(should_fail_with = "commitment not in member tree")]
fn rejects_a_non_member() {
    let secret = 0x1234567890abcdef;
    let mut node = commitment_of(secret);
    for _ in 0..TREE_DEPTH {
        node = hash2(node, 0);
    }
    // same tree, but an outsider's secret
    let outsider = 0xdeadbeef;
    main(
        node,
        7,
        nullifier_of(outsider, 7),
        1,
        outsider,
        [0; TREE_DEPTH],
        [false; TREE_DEPTH],
    );
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn rejects_a_weighted_ballot() {
    let secret = 0x1234567890abcdef;
    let mut node = commitment_of(secret);
    for _ in 0..TREE_DEPTH {
        node = hash2(node, 0);
    }
    main(
        node,
        7,
        nullifier_of(secret, 7),
        1000,
        secret,
        [0; TREE_DEPTH],
        [false; TREE_DEPTH],
    );
}

#[test(should_fail_with = "nullifier does not match secret")]
fn rejects_a_forged_nullifier() {
    let secret = 0x1234567890abcdef;
    let mut node = commitment_of(secret);
    for _ in 0..TREE_DEPTH {
        node = hash2(node, 0);
    }
    // trying to vote twice by inventing a second tag for the same proposal
    main(
        node,
        7,
        nullifier_of(secret, 8),
        1,
        secret,
        [0; TREE_DEPTH],
        [false; TREE_DEPTH],
    );
}
